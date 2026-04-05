import time
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from src.models import AirportWeather, WeatherResponse
from src.weather import WeatherCache


@pytest.fixture
def mock_met_norway_response():
    return {
        "properties": {
            "timeseries": [
                {
                    "data": {
                        "instant": {
                            "details": {
                                "air_temperature": 15.5,
                                "wind_speed": 5.0,  # 5.0 m/s * 1.94384 = 9.7 knots
                                "wind_from_direction": 270.0,
                            }
                        },
                        "next_1_hours": {
                            "summary": {"symbol_code": "partlycloudy_day"}
                        },
                    }
                }
            ]
        }
    }


@pytest.mark.asyncio
async def test_fetch_and_parse_airport_success(mock_met_norway_response):
    cache = WeatherCache()
    airport = {"icao": "EGLL", "name": "Heathrow", "lat": 51.4700, "lon": -0.4543}

    # Create a mock response
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = mock_met_norway_response

    # Create a mock client
    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_client.get.return_value = mock_response

    result = await cache._fetch_and_parse_airport(mock_client, airport)

    assert result is not None
    assert result.icao == "EGLL"
    assert result.name == "Heathrow"
    assert result.condition == "partlycloudy_day"
    assert result.temperature_c == 15.5
    assert result.wind_speed_kts == 9.7  # 5.0 * 1.94384 rounded to 1 decimal
    assert result.wind_direction_deg == 270.0


@pytest.mark.asyncio
async def test_fetch_and_parse_airport_failure():
    cache = WeatherCache()
    airport = {"icao": "EGLL", "name": "Heathrow", "lat": 51.4700, "lon": -0.4543}

    # Create a mock client that raises an exception
    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_client.get.side_effect = httpx.HTTPError("Network error")

    result = await cache._fetch_and_parse_airport(mock_client, airport)

    # Should gracefully return None on failure
    assert result is None


@pytest.mark.asyncio
@patch("src.weather.WeatherCache._fetch_and_parse_airport")
async def test_get_weather_concurrent_fetch(mock_fetch):
    # Setup mock to return a valid AirportWeather object
    mock_weather = AirportWeather(
        icao="EGLL",
        name="Heathrow",
        condition="clearsky_day",
        temperature_c=20.0,
        wind_speed_kts=10.0,
        wind_direction_deg=180.0,
    )
    mock_fetch.return_value = mock_weather

    cache = WeatherCache()

    # Force last_update to be old to trigger a fetch
    cache.last_update = 0.0

    response = await cache.get_weather()

    assert isinstance(response, WeatherResponse)
    # There are 5 airports in LONDON_AIRPORTS, so we expect 5 results if all succeed
    assert len(response.weather) == 5
    assert response.cache_age_seconds == 0.0

    # Verify the mock was called 5 times (once for each airport)
    assert mock_fetch.call_count == 5


@pytest.mark.asyncio
@patch("src.weather.WeatherCache._fetch_and_parse_airport")
async def test_get_weather_caching_logic(mock_fetch):
    # Setup mock
    mock_fetch.return_value = AirportWeather(
        icao="EGLL",
        name="Heathrow",
        condition="clearsky_day",
        temperature_c=20.0,
        wind_speed_kts=10.0,
        wind_direction_deg=180.0,
    )

    cache = WeatherCache()

    # First call triggers fetch
    await cache.get_weather()
    assert mock_fetch.call_count == 5

    # Second call within TTL should hit cache
    mock_fetch.reset_mock()
    response = await cache.get_weather()

    assert mock_fetch.call_count == 0
    assert response.cache_age_seconds >= 0.0


@pytest.mark.asyncio
@patch("src.weather.httpx.AsyncClient")
async def test_get_weather_fallback_on_total_failure(mock_client_class):
    # Setup client to fail when context manager is entered
    mock_client_class.return_value.__aenter__.side_effect = Exception(
        "Total API failure"
    )

    cache = WeatherCache()

    # Populate cache with old data
    old_weather = AirportWeather(
        icao="EGLL",
        name="Heathrow",
        condition="clearsky_day",
        temperature_c=20.0,
        wind_speed_kts=10.0,
        wind_direction_deg=180.0,
    )
    cache.cached_response = WeatherResponse(
        timestamp=int(time.time() - 3600),  # 1 hour ago
        cache_age_seconds=0.0,
        weather=[old_weather],
    )
    cache.last_update = time.time() - 3600  # Expired

    # Fetch should fail and fallback to stale data
    response = await cache.get_weather()

    assert len(response.weather) == 1
    assert response.weather[0].icao == "EGLL"
    # Cache age should be approximately 3600 seconds
    assert response.cache_age_seconds > 3500


@pytest.mark.asyncio
@patch("src.weather.httpx.AsyncClient")
async def test_get_weather_empty_fallback_on_initial_failure(mock_client_class):
    # Setup client to fail
    mock_client_class.return_value.__aenter__.side_effect = Exception(
        "API down initially"
    )

    cache = WeatherCache()
    # No prior cached data

    response = await cache.get_weather()

    # Should fallback to empty array
    assert isinstance(response, WeatherResponse)
    assert len(response.weather) == 0
