// One city lookup and one forecast request when the tab opens or the city
// changes. No location permission, saved coordinates, or polling loop.

export function weatherDescription(code) {
  if (code === 0) return "Clear sky";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Cloudy";
  if ([45, 48].includes(code)) return "Foggy";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rainy";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snowy";
  if ([95, 96, 99].includes(code)) return "Thunderstorms";
  return "Current weather";
}

export async function fetchWeather(city, fetcher = fetch, unit = "fahrenheit") {
  const temperatureUnit = unit === "celsius" ? "celsius" : "fahrenheit";
  const windUnit = temperatureUnit === "celsius" ? "km/h" : "mph";
  const locationUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
  locationUrl.searchParams.set("name", city);
  locationUrl.searchParams.set("count", "1");
  locationUrl.searchParams.set("language", "en");
  const locationResponse = await fetcher(locationUrl);
  if (!locationResponse.ok) throw new Error("City lookup failed");
  const location = (await locationResponse.json()).results?.[0];
  if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) throw new Error("City not found");

  const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
  forecastUrl.searchParams.set("latitude", String(location.latitude));
  forecastUrl.searchParams.set("longitude", String(location.longitude));
  forecastUrl.searchParams.set("current", "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m");
  forecastUrl.searchParams.set("daily", "temperature_2m_max,temperature_2m_min");
  forecastUrl.searchParams.set("forecast_days", "1");
  forecastUrl.searchParams.set("temperature_unit", temperatureUnit);
  forecastUrl.searchParams.set("wind_speed_unit", temperatureUnit === "celsius" ? "kmh" : "mph");
  forecastUrl.searchParams.set("timezone", "auto");
  const forecastResponse = await fetcher(forecastUrl);
  if (!forecastResponse.ok) throw new Error("Forecast lookup failed");
  const forecast = await forecastResponse.json();
  const current = forecast.current;
  if (!Number.isFinite(current?.temperature_2m)) throw new Error("No current weather");
  return {
    city: location.name,
    region: location.admin1 || location.country || "",
    unit: temperatureUnit === "celsius" ? "C" : "F",
    windUnit,
    temperature: Math.round(current.temperature_2m),
    description: weatherDescription(current.weather_code),
    high: Math.round(forecast.daily?.temperature_2m_max?.[0] ?? current.temperature_2m),
    low: Math.round(forecast.daily?.temperature_2m_min?.[0] ?? current.temperature_2m),
    humidity: Math.round(current.relative_humidity_2m ?? 0),
    feelsLike: Math.round(current.apparent_temperature ?? current.temperature_2m),
    wind: Math.round(current.wind_speed_10m ?? 0)
  };
}

export function createWeatherCard({ getCity, getUnit, setUnit, openSettings }) {
  const temperature = document.querySelector("#weather-temperature");
  const unitButton = document.querySelector("#weather-unit");
  const heading = document.querySelector("#weather-heading");
  const location = document.querySelector("#weather-location");
  const details = document.querySelector("#weather-details");
  const setup = document.querySelector("#weather-setup");
  let status = "empty";
  let weather = null;
  let requestId = 0;

  function render() {
    const city = getCity().trim();
    temperature.textContent = weather && status === "ready" ? `${weather.temperature}°${weather.unit}` : "--°";
    unitButton.hidden = status !== "ready";
    unitButton.textContent = weather?.unit === "C" ? "°F" : "°C";
    unitButton.setAttribute("aria-label", weather?.unit === "C" ? "Switch to Fahrenheit" : "Switch to Celsius");
    heading.textContent = weather && status === "ready" ? weather.description : "Weather";
    location.textContent = status === "loading" ? `Checking ${city}…`
      : status === "ready" ? `${weather.city}, ${weather.region} · H ${weather.high}° L ${weather.low}°`
      : status === "error" ? `Couldn't load weather for ${city}.`
      : "Set your city in Settings.";
    details.replaceChildren();
    if (status === "ready") {
      for (const value of [`Humidity ${weather.humidity}%`, `Feels ${weather.feelsLike}°${weather.unit}`, `Wind ${weather.wind} ${weather.windUnit}`]) {
        const chip = document.createElement("span");
        chip.textContent = value;
        details.append(chip);
      }
    }
    details.hidden = status !== "ready";
    setup.hidden = status === "ready" || status === "loading";
    setup.firstChild.textContent = status === "error" ? "Try again " : "Set city ";
  }

  async function load() {
    const city = getCity().trim();
    const unit = getUnit();
    const currentRequest = ++requestId;
    weather = null;
    if (!city) { status = "empty"; render(); return; }
    status = "loading";
    render();
    try {
      const result = await fetchWeather(city, fetch, unit);
      if (currentRequest !== requestId) return;
      weather = result;
      status = "ready";
    } catch {
      if (currentRequest !== requestId) return;
      status = "error";
    }
    render();
  }

  setup.addEventListener("click", () => {
    if (status === "error") load();
    else { openSettings(); document.querySelector("#settings-weather-city").focus(); }
  });
  unitButton.addEventListener("click", async () => {
    const nextUnit = getUnit() === "celsius" ? "fahrenheit" : "celsius";
    await setUnit(nextUnit);
    load();
  });
  return { load, render };
}
