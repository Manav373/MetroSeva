"""Populates the database with realistic multilingual complaints for demo & testing."""

import sys
import os
import requests

# Ensure cte path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

API_URL = "http://localhost:8000/v1/complaints/bulk"

SAMPLE_COMPLAINTS = [
    # Gujarati Safety
    {"station_id": "STN_PALDI", "channel": "app", "raw_text": "પ્લેટફોર્મ 2 પર ટ્રેક પર ધુમાડો નીકળે છે અને આગ લાગી છે, જલ્દી તપાસ કરો!"},
    {"station_id": "STN_KALUPUR", "channel": "paper", "raw_text": "એક વૃદ્ધ વ્યક્તિ ટ્રેક પર પડી ગયા છે, ઈમરજન્સી રોકો!"},
    {"station_id": "STN_CENTRAL", "channel": "app", "raw_text": "ગેસની તીવ્ર વાસ આવી રહી છે લિફ્ટ નજીક, મુસાફરોને શ્વાસ લેવામાં તકલીફ છે."},

    # Hindi Safety
    {"station_id": "STN_APMC", "channel": "social", "raw_text": "प्लेटफॉर्म 1 पर सीढ़ी के पास आग की लपटें दिख रही हैं, तुरंत सुरक्षा दल भेजिए!"},
    {"station_id": "STN_THALTEJ", "channel": "app", "raw_text": "ट्रैक पर एक बच्चा गिर गया है, मेट्रो रोको!"},

    # Gujlish Safety
    {"station_id": "STN_PALDI", "channel": "app", "raw_text": "Track par manas padi gayo chhe urgently ambulance ane security moklo"},
    {"station_id": "STN_KALUPUR", "channel": "social", "raw_text": "Platform 2 par aag ane dhumaado chhe, fire brigade ne phone karo"},

    # Lifts & Escalators (Gujlish, Gujarati, English)
    {"station_id": "STN_PALDI", "channel": "social", "raw_text": "Platform 1 ni lift bandh chhe ane vradhdh loko heran thay chhe"},
    {"station_id": "STN_CENTRAL", "channel": "app", "raw_text": "Escalator band che platform 2 par chadhva mate taklif pade chhe"},
    {"station_id": "STN_KALUPUR", "channel": "app", "raw_text": "The elevator at gate 3 is not working since yesterday, wheelchair users cannot exit."},
    {"station_id": "STN_THALTEJ", "channel": "paper", "raw_text": "લિફ્ટ બંધ છે અને બટન તૂટેલું છે"},

    # Cleanliness (Gujarati, Hindi, English, Gujlish)
    {"station_id": "STN_KALUPUR", "channel": "paper", "raw_text": "વોશરૂમ ખૂબ ગંદો છે અને પાણી નથી આવતું, દુર્ગંધ આવે છે"},
    {"station_id": "STN_PALDI", "channel": "app", "raw_text": "प्लेटफॉर्म पर कचरा फैला हुआ है और कूड़ेदान भरा हुआ है"},
    {"station_id": "STN_CENTRAL", "channel": "social", "raw_text": "Track near coach 2 has plastic bottles and trash accumulated."},
    {"station_id": "STN_APMC", "channel": "app", "raw_text": "Platform par kachro ane gandagi bahu vadhare chhe safai karo"},

    # Fare & Ticketing (Hindi, Gujlish, English, Gujarati)
    {"station_id": "STN_CENTRAL", "channel": "app", "raw_text": "स्मार्ट कार्ड रिचार्ज किया लेकिन 200 रुपये कट गए और कार्ड में बैलेंस नहीं आया"},
    {"station_id": "STN_PALDI", "channel": "social", "raw_text": "AFC gate open nahi hua par 20 rupiya card mathi kapi lidha"},
    {"station_id": "STN_THALTEJ", "channel": "app", "raw_text": "Token vending machine swallowed 50 rupee note but did not dispense token."},
    {"station_id": "STN_KALUPUR", "channel": "paper", "raw_text": "સ્માર્ટ કાર્ડમાં બેલેન્સ કપાઈ ગયું પણ ગેટ ન ખુલ્યો"},

    # Staff Behaviour
    {"station_id": "STN_PALDI", "channel": "app", "raw_text": "Counter par staff bahu rudely vat kare chhe ticket apya vagar jhagdo kare chhe"},
    {"station_id": "STN_KALUPUR", "channel": "paper", "raw_text": "टिकट काउंटर पर कर्मचारी बहुत बदतमीजी से बात कर रहा था और लाइन में खड़े लोगों को डांट रहा था"},
    {"station_id": "STN_CENTRAL", "channel": "social", "raw_text": "Security guard was extremely aggressive and misbehaved at baggage check."}
]


def seed():
    print(f"Connecting to {API_URL}...")
    try:
        res = requests.post(API_URL, json={"station_id": "STN_CENTRAL", "channel": "bulk_seed", "items": SAMPLE_COMPLAINTS})
        if res.status_code == 201:
            print(f"Successfully seeded {len(res.json())} complaints across Gujarati, Hindi, English, and Gujlish!")
        else:
            print(f"Failed to seed: {res.status_code} - {res.text}")
    except Exception as e:
        print(f"Error connecting to backend: {e}")
        print("Tip: Make sure the FastAPI backend is running via: py -m uvicorn app.main:app --app-dir ingest-service")


if __name__ == "__main__":
    seed()
