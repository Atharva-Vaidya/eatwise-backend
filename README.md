# 🍽️ EatWise — AI Food Coach

EatWise is an AI-powered food assistant that helps users make healthier eating decisions by analyzing meals in real time and providing actionable insights.

---

## 🚀 Features

- 🧠 AI-powered meal analysis using Gemini
- 📊 Nutritional breakdown (calories, protein, carbs, fats)
- 💯 Health score for each meal
- 💡 Personalized improvement tips
- ⚡ Fast and responsive UI
- ☁️ Deployed on Google Cloud Run

---

## 🛠️ Tech Stack

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js, Express
- **AI:** Google Gemini API
- **Cloud:** Google Cloud Run
- **(Planned):** Firestore for caching & insights

---

## 📂 Project Structure

```
eatwise-backend/
│── server.js        # Main backend server
│── app.js           # App configuration
│── index.html       # Frontend UI
│── style.css        # Styling
│── package.json     # Dependencies
│── Dockerfile       # Container config
```

---

## ⚙️ Setup & Run Locally

### 1. Clone the repo
```bash
git clone https://github.com/Atharva-Vaidya/eatwise-backend.git
cd eatwise-backend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Add environment variable
Create a `.env` file:
```
GEMINI_API_KEY=your_api_key_here
```

### 4. Run the server
```bash
npm start
```

Visit:
```
http://localhost:8080
```

---

## ☁️ Deployment (Google Cloud Run)

1. Push code to GitHub  
2. Go to **Google Cloud Run**  
3. Click **Deploy → Build from source**  
4. Connect your GitHub repo  
5. Add environment variable:  
   - `GEMINI_API_KEY`  
6. Deploy 🚀  

---

## 🔐 Security

- API keys are stored securely using environment variables  
- No sensitive data is exposed on the frontend  

---

## 📈 Future Improvements

- 📅 Weekly insights & streak tracking  
- 🗂️ Meal history with Firestore  
- 🎤 Voice input for logging meals  
- 📱 Mobile-friendly enhancements  

---

## 🤝 Contributing

Feel free to fork this repo and improve it!

---

## 📌 License

This project is for educational and hackathon purposes.
