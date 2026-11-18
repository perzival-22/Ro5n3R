import test from "node:test";
import assert from "node:assert/strict";
import { fetchWeather, weatherDescription } from "../weather.js";

test("weather lookup sends a named city and reads current conditions", async () => {
  const urls = [];
  const fetcher = async (url) => {
    urls.push(url);
    return { ok: true, json: async () => urls.length === 1
      ? { results: [{ name: "Portland", admin1: "Maine", latitude: 43.66, longitude: -70.25 }] }
      : { current: { temperature_2m: 46.6, weather_code: 2, relative_humidity_2m: 62, apparent_temperature: 42.2, wind_speed_10m: 9.3 }, daily: { temperature_2m_max: [50.1], temperature_2m_min: [38.4] } } };
  };
  const result = await fetchWeather("Portland, Maine", fetcher);
  assert.equal(urls[0].searchParams.get("name"), "Portland, Maine");
  assert.equal(urls[1].searchParams.get("temperature_unit"), "fahrenheit");
  assert.deepEqual(result, { city: "Portland", region: "Maine", unit: "F", windUnit: "mph", temperature: 47, description: "Partly cloudy", high: 50, low: 38, humidity: 62, feelsLike: 42, wind: 9 });
});

test("Celsius weather requests matching temperature and wind units", async () => {
  const urls = [];
  const fetcher = async (url) => {
    urls.push(url);
    return { ok: true, json: async () => urls.length === 1
      ? { results: [{ name: "Paris", country: "France", latitude: 48.86, longitude: 2.35 }] }
      : { current: { temperature_2m: 8.4, weather_code: 3, relative_humidity_2m: 70, apparent_temperature: 5.7, wind_speed_10m: 12.2 }, daily: { temperature_2m_max: [10.2], temperature_2m_min: [3.8] } } };
  };
  const result = await fetchWeather("Paris", fetcher, "celsius");
  assert.equal(urls[1].searchParams.get("temperature_unit"), "celsius");
  assert.equal(urls[1].searchParams.get("wind_speed_unit"), "kmh");
  assert.equal(result.unit, "C");
  assert.equal(result.windUnit, "km/h");
  assert.equal(result.temperature, 8);
});

test("weather codes produce readable conditions", () => {
  assert.equal(weatherDescription(0), "Clear sky");
  assert.equal(weatherDescription(65), "Rainy");
  assert.equal(weatherDescription(75), "Snowy");
});
