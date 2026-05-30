#!/usr/bin/env python3

import requests
import json
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Any
import time

class SyriaEnvironmentalDataAggregator:
    def __init__(self):
        self.major_cities = {
            "Damascus": {"lat": 33.51, "lon": 36.29, "population": 2103000},
            "Aleppo": {"lat": 36.20, "lon": 37.16, "population": 4118000},
            "Idlib": {"lat": 35.933, "lon": 36.633, "population": 1172000},
            "Rif Dimashq": {"lat": 33.5, "lon": 37.3833, "population": 3372000},
            "Homs": {"lat": 34.73, "lon": 36.72, "population": 1790000},
            "Hama": {"lat": 35.13, "lon": 36.76, "population": 2147000},
            "Daraa": {"lat": 32.6264, "lon": 36.1033, "population": 966000},
            "Latakia": {"lat": 35.53, "lon": 35.79, "population": 1346000},
            "Deir ez-Zor": {"lat": 35.34, "lon": 40.14, "population": 1267000},
            "Quneitra": {"lat": 33.0776, "lon": 35.8934, "population": 124000},
            "Raqqa": {"lat": 35.95, "lon": 39.01, "population": 940000},
            "Al-Hasakah": {"lat": 36.5079, "lon": 40.7463, "population": 1865000},
            "Tartus": {"lat": 34.89, "lon": 35.89, "population": 1172000},
            "As-Suwayda": {"lat": 32.709, "lon": 36.5695, "population": 540000}
        }
        
        self.report_data = {
            "metadata": {
                "country": "Syria",
                "report_date": datetime.now().isoformat(),
                "data_sources": ["Open-Meteo", "NASA POWER", "World Bank Climate API"],
                "cities_analyzed": len(self.major_cities)
            },
            "cities": {}
        }

    def fetch_openmeteo_current_weather(self, lat: float, lon: float) -> Dict[str, Any]:
        """Fetch current weather data from Open-Meteo API"""
        base_url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
            "daily": "temperature_2m_max,temperature_2m_min,temperature_2m_mean,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,daylight_duration,sunshine_duration,precipitation_sum,rain_sum,precipitation_hours,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant",
            "timezone": "auto"
        }
        
        try:
            response = requests.get(base_url, params=params, timeout=30)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Error fetching current weather: {e}")
            return {}

    def fetch_openmeteo_historical_weather(self, lat: float, lon: float, years: int = 5) -> Dict[str, Any]:
        """Fetch historical weather data from Open-Meteo API"""
        base_url = "https://archive-api.open-meteo.com/v1/archive"
        end_date = datetime.now()
        start_date = end_date - timedelta(days=years * 365)
        
        params = {
            "latitude": lat,
            "longitude": lon,
            "start_date": start_date.strftime("%Y-%m-%d"),
            "end_date": end_date.strftime("%Y-%m-%d"),
            "daily": "temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,wind_speed_10m_max,et0_fao_evapotranspiration,surface_pressure_mean",
            "timezone": "auto"
        }
        
        try:
            response = requests.get(base_url, params=params, timeout=60)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Error fetching historical weather: {e}")
            return {}

    def fetch_nasa_power_climate(self, lat: float, lon: float) -> Dict[str, Any]:
        """Fetch climate and agricultural data from NASA POWER API"""
        base_url = "https://power.larc.nasa.gov/api/temporal/daily/point"
        
        # Use dates that are definitely in the past and valid
        end_date = datetime.now() - timedelta(days=2)
        start_date = end_date - timedelta(days=365)
        
        params = {
            "parameters": "T2M_MAX,T2M_MIN,T2M,RH2M,PRECTOTCORR,WS10M",
            "community": "RE",  # Changed from AG to RE (Renewable Energy)
            "longitude": f"{lon:.2f}",
            "latitude": f"{lat:.2f}",
            "start": start_date.strftime("%Y%m%d"),
            "end": end_date.strftime("%Y%m%d"),
            "format": "JSON"
        }
        
        try:
            response = requests.get(base_url, params=params, timeout=60)
            if response.status_code == 422:
                print(f"NASA POWER API parameter issue - skipping (data available from Open-Meteo)")
                return {"skipped": True, "reason": "API parameter validation failed"}
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"NASA POWER data unavailable (using Open-Meteo data instead): {str(e)[:100]}")
            return {"skipped": True, "reason": str(e)[:100]}

    def fetch_world_bank_climate(self) -> Dict[str, Any]:
        """Fetch climate data from World Bank Climate Data API for Syria"""
        climate_data = {}
        
        try:
            base_url = "https://climateknowledgeportal.worldbank.org/api/v2/country"
            
            precipitation_url = f"{base_url}/SYR/prcp/data.json"
            temperature_url = f"{base_url}/SYR/tas/data.json"
            
            precip_response = requests.get(precipitation_url, timeout=30)
            temp_response = requests.get(temperature_url, timeout=30)
            
            if precip_response.status_code == 200:
                climate_data["precipitation"] = precip_response.json()
            
            if temp_response.status_code == 200:
                climate_data["temperature"] = temp_response.json()
                
        except Exception as e:
            print(f"World Bank climate data unavailable: {e}")
        
        return climate_data

    def calculate_climate_trends(self, historical_data: Dict) -> Dict[str, Any]:
        """Calculate climate trends from historical data"""
        if not historical_data or "daily" not in historical_data:
            return {}
        
        daily_data = historical_data["daily"]
        df = pd.DataFrame(daily_data)
        
        trends = {}
        
        if "temperature_2m_mean" in df.columns:
            df["date"] = pd.to_datetime(df["time"])
            df["year"] = df["date"].dt.year
            df["month"] = df["date"].dt.month
            
            yearly_avg_temp = df.groupby("year")["temperature_2m_mean"].mean()
            
            if len(yearly_avg_temp) > 1:
                temp_change = yearly_avg_temp.iloc[-1] - yearly_avg_temp.iloc[0]
                trends["temperature_trend_celsius"] = round(temp_change, 2)
                trends["temperature_change_rate_per_year"] = round(temp_change / (len(yearly_avg_temp) - 1), 3)
        
        if "precipitation_sum" in df.columns:
            yearly_total_rainfall = df.groupby("year")["precipitation_sum"].sum()
            
            if len(yearly_total_rainfall) > 1:
                rainfall_change = yearly_total_rainfall.iloc[-1] - yearly_total_rainfall.iloc[0]
                trends["rainfall_trend_mm"] = round(rainfall_change, 2)
                trends["average_annual_rainfall_mm"] = round(yearly_total_rainfall.mean(), 2)
        
        if "surface_pressure_mean" in df.columns:
             trends["avg_surface_pressure_hpa"] = round(df["surface_pressure_mean"].mean(), 1)
        
        return trends

    def estimate_air_quality_index(self, weather_data: Dict) -> Dict[str, Any]:
        """Estimate air quality based on weather and conditions"""
        aqi_data = {
            "estimated": True,
            "method": "Weather-based estimation",
            "factors": {}
        }
        
        current = weather_data.get("current", {})
        
        aqi_data["factors"]["wind_speed_m_s"] = current.get("wind_speed_10m", 0)
        aqi_data["factors"]["humidity_percent"] = current.get("relative_humidity_2m", 0)
        aqi_data["factors"]["cloud_cover_percent"] = current.get("cloud_cover", 0)
        aqi_data["factors"]["pressure_msl_hpa"] = current.get("pressure_msl", 1013)
        
        wind_speed = current.get("wind_speed_10m", 0)
        
        if wind_speed < 5:
            aqi_category = "Poor (Low dispersion)"
            aqi_score = 100
        elif wind_speed < 10:
            aqi_category = "Moderate"
            aqi_score = 70
        else:
            aqi_category = "Good (Good dispersion)"
            aqi_score = 40
        
        aqi_data["estimated_aqi"] = aqi_score
        aqi_data["category"] = aqi_category
        aqi_data["health_recommendation"] = self.get_health_recommendation(aqi_score)
        
        return aqi_data

    def get_health_recommendation(self, aqi_score: int) -> str:
        """Get health recommendation based on AQI score"""
        if aqi_score <= 50:
            return "Air quality is good. Outdoor activities are safe."
        elif aqi_score <= 75:
            return "Moderate air quality. Sensitive individuals should limit prolonged outdoor exertion."
        else:
            return "Poor air quality. Everyone should limit prolonged outdoor exertion."

    def analyze_drought_risk(self, precipitation_data: Dict) -> Dict[str, Any]:
        """Analyze drought risk based on precipitation data"""
        drought_analysis = {}
        
        if "daily" in precipitation_data and "precipitation_sum" in precipitation_data["daily"]:
            df = pd.DataFrame(precipitation_data["daily"])
            df["date"] = pd.to_datetime(df["time"])
            df["month"] = df["date"].dt.month
            
            monthly_rainfall = df.groupby("month")["precipitation_sum"].mean()
            
            dry_season_months = monthly_rainfall[monthly_rainfall < 20].index.tolist()
            wet_season_months = monthly_rainfall[monthly_rainfall >= 20].index.tolist()
            
            drought_analysis["dry_season_months"] = dry_season_months
            drought_analysis["wet_season_months"] = wet_season_months
            drought_analysis["annual_precipitation_mm"] = round(monthly_rainfall.sum() * 30.44, 2)
            
            if drought_analysis["annual_precipitation_mm"] < 300:
                drought_analysis["drought_risk"] = "Very High"
                drought_analysis["classification"] = "Arid/Semi-arid"
            elif drought_analysis["annual_precipitation_mm"] < 600:
                drought_analysis["drought_risk"] = "High"
                drought_analysis["classification"] = "Semi-arid"
            else:
                drought_analysis["drought_risk"] = "Moderate"
                drought_analysis["classification"] = "Sub-humid"
        
        return drought_analysis

    def process_city_data(self, city_name: str, city_info: Dict) -> Dict[str, Any]:
        """Process all environmental data for a city"""
        print(f"\n{'='*60}")
        print(f"Processing data for {city_name}...")
        print(f"{'='*60}")
        
        city_data = {
            "coordinates": {
                "latitude": city_info["lat"],
                "longitude": city_info["lon"]
            },
            "population": city_info["population"]
        }
        
        print(f"Fetching current weather...")
        current_weather = self.fetch_openmeteo_current_weather(
            city_info["lat"], city_info["lon"]
        )
        time.sleep(0.5)  # Reduced sleep time
        
        print(f"Fetching historical weather (5 years)...")
        historical_weather = self.fetch_openmeteo_historical_weather(
            city_info["lat"], city_info["lon"]
        )
        time.sleep(0.5)
        
        print(f"Fetching NASA POWER climate data...")
        nasa_power = self.fetch_nasa_power_climate(
            city_info["lat"], city_info["lon"]
        )
        time.sleep(0.5)
        
        print(f"Analyzing climate trends...")
        climate_trends = self.calculate_climate_trends(historical_weather)
        
        print(f"Estimating air quality...")
        air_quality = self.estimate_air_quality_index(current_weather)
        
        print(f"Analyzing drought risk...")
        drought_risk = self.analyze_drought_risk(historical_weather)
        
        if current_weather and "current" in current_weather:
            city_data["current_conditions"] = {
                "temperature_celsius": current_weather["current"].get("temperature_2m"),
                "feels_like_celsius": current_weather["current"].get("apparent_temperature"),
                "humidity_percent": current_weather["current"].get("relative_humidity_2m"),
                "precipitation_mm": current_weather["current"].get("precipitation", 0),
                "wind_speed_kmh": current_weather["current"].get("wind_speed_10m"),
                "wind_direction_degrees": current_weather["current"].get("wind_direction_10m"),
                "pressure_msl_hpa": current_weather["current"].get("pressure_msl"),
                "pressure_surface_hpa": current_weather["current"].get("surface_pressure"),
                "cloud_cover_percent": current_weather["current"].get("cloud_cover"),
                "weather_description": self.get_weather_description(current_weather["current"].get("weather_code", 0))
            }
        
        if current_weather and "daily" in current_weather:
            city_data["daily_forecast_summary"] = {
                "tomorrow_max_temp_c": current_weather["daily"]["temperature_2m_max"][1] if len(current_weather["daily"]["temperature_2m_max"]) > 1 else None,
                "tomorrow_min_temp_c": current_weather["daily"]["temperature_2m_min"][1] if len(current_weather["daily"]["temperature_2m_min"]) > 1 else None,
                "tomorrow_precipitation_mm": current_weather["daily"]["precipitation_sum"][1] if len(current_weather["daily"]["precipitation_sum"]) > 1 else None
            }
        
        city_data["climate_trends"] = climate_trends
        city_data["air_quality"] = air_quality
        city_data["drought_risk"] = drought_risk
        
        if historical_weather and "daily" in historical_weather:
            df = pd.DataFrame(historical_weather["daily"])
            
            city_data["historical_summary"] = {
                "period_start": historical_weather["daily"]["time"][0] if "time" in historical_weather["daily"] else None,
                "period_end": historical_weather["daily"]["time"][-1] if "time" in historical_weather["daily"] else None,
                "avg_max_temp_c": round(df["temperature_2m_max"].mean(), 2) if "temperature_2m_max" in df.columns else None,
                "avg_min_temp_c": round(df["temperature_2m_min"].mean(), 2) if "temperature_2m_min" in df.columns else None,
                "total_precipitation_mm": round(df["precipitation_sum"].sum(), 2) if "precipitation_sum" in df.columns else None,
                "max_wind_speed_kmh": round(df["wind_speed_10m_max"].max(), 2) if "wind_speed_10m_max" in df.columns else None,
                "avg_surface_pressure_hpa": round(df["surface_pressure_mean"].mean(), 2) if "surface_pressure_mean" in df.columns else None
            }
        
        print(f"✓ Completed {city_name}")
        
        return city_data

    def get_weather_description(self, code: int) -> str:
        """Convert weather code to description"""
        weather_codes = {
            0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
            45: "Fog", 48: "Depositing rime fog", 51: "Light drizzle", 53: "Moderate drizzle",
            55: "Dense drizzle", 61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
            71: "Slight snow fall", 73: "Moderate snow fall", 75: "Heavy snow fall",
            80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
            95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail"
        }
        return weather_codes.get(code, f"Unknown (code: {code})")

    def add_country_level_analysis(self):
        """Add country-wide environmental analysis"""
        print(f"\n{'='*60}")
        print("Fetching country-level climate data...")
        print(f"{'='*60}")
        
        world_bank_climate = self.fetch_world_bank_climate()
        self.report_data["country_level"] = {
            "world_bank_climate_data": world_bank_climate,
            "climate_context": {
                "classification": "Mostly semi-arid to arid",
                "main_climate_challenges": [
                    "Water scarcity and declining groundwater levels",
                    "Increasing drought frequency and severity",
                    "Rising temperatures and heat waves",
                    "Rainfall pattern changes affecting agriculture",
                    "Air quality concerns in urban areas"
                ],
                "key_water_basins": [
                    "Euphrates River Basin", "Orontes River Basin", "Yarmouk River Basin",
                    "Barada and Awaj Basin", "Coastal Basin"
                ]
            }
        }

    def generate_summary(self):
        """Generate overall summary"""
        print(f"\n{'='*60}")
        print("Generating summary...")
        print(f"{'='*60}")
        
        summary = {
            "total_cities_analyzed": len(self.major_cities),
            "data_collection_date": datetime.now().isoformat(),
            "key_findings": [],
            "recommendations": []
        }
        
        avg_drought_risk = []
        avg_temp_trends = []
        
        for city_name, city_data in self.report_data["cities"].items():
            if "drought_risk" in city_data and "drought_risk" in city_data["drought_risk"]:
                avg_drought_risk.append(city_data["drought_risk"]["drought_risk"])
            
            if "climate_trends" in city_data and "temperature_trend_celsius" in city_data["climate_trends"]:
                avg_temp_trends.append(city_data["climate_trends"]["temperature_trend_celsius"])
        
        if avg_drought_risk:
            high_risk_count = avg_drought_risk.count("High") + avg_drought_risk.count("Very High")
            summary["key_findings"].append(f"{high_risk_count}/{len(avg_drought_risk)} cities at high/very high drought risk")
        
        if avg_temp_trends:
            avg_temp_change = round(sum(avg_temp_trends) / len(avg_temp_trends), 2)
            if avg_temp_change > 0:
                summary["key_findings"].append(f"Average temperature increase of {avg_temp_change}°C over analysis period")
            else:
                summary["key_findings"].append(f"Average temperature change of {avg_temp_change}°C over analysis period")
        
        summary["recommendations"] = [
            "Implement water conservation and efficient irrigation systems",
            "Develop drought-resistant agricultural practices",
            "Monitor air quality in major urban centers",
            "Enhance early warning systems for extreme weather events",
            "Invest in renewable energy to reduce pollution"
        ]
        
        self.report_data["summary"] = summary

    def run(self):
        """Run the complete data aggregation process"""
        print(f"\n{'#'*60}")
        print(f"SYRIA ENVIRONMENTAL DATA AGGREGATION REPORT")
        print(f"{'#'*60}")
        print(f"Report Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Cities to analyze: {list(self.major_cities.keys())}")
        
        self.add_country_level_analysis()
        
        for city_name, city_info in self.major_cities.items():
            try:
                city_data = self.process_city_data(city_name, city_info)
                self.report_data["cities"][city_name] = city_data
            except KeyboardInterrupt:
                print(f"\n\nProcess interrupted by user. Saving partial data...")
                break
            except Exception as e:
                print(f"Error processing {city_name}: {e}")
                continue
        
        self.generate_summary()
        
        output_file = "syria_environmental_data_report.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(self.report_data, f, indent=2, ensure_ascii=False)
        
        print(f"\n{'#'*60}")
        print(f"✓ REPORT COMPLETE")
        print(f"{'#'*60}")
        print(f"Output file: {output_file}")
        print(f"Total cities analyzed: {len(self.report_data['cities'])}")
        print(f"File size: {len(json.dumps(self.report_data))} bytes")
        print(f"{'#'*60}\n")
        
        return self.report_data

if __name__ == "__main__":
    aggregator = SyriaEnvironmentalDataAggregator()
    report = aggregator.run()
