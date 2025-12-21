# 🍭 Candy City Coding — “Robot Lost in Candy City” (Python for Kids)

A playful **story-mode web app** that teaches kids (age **6–10**) real Python by helping **RoboPop 🤖** 

travel from the **bottom-left** of Candy City to the **🏠 Home of Coders** in the **top-right**.

Kids type simple Python like `move(3)` and `turn_left()` and the game runs it **safely in the browser** using **Pyodide** 


— no installs needed.

---

## ✨ Features

- **10 Story Levels + Dialogue**: short, fun missions with hints and kid-friendly pacing  
- **Real Python in the browser**: runs actual Python via **Pyodide** (no server required)  
- **XP + Badges**: extra rewards for using **loops** and **variables**  
- **Flickering Bonus Candy (✨🍬)**: step on it to earn **bonus XP**  
- **Teacher Dashboard (localStorage)**: track progress per kid (easy to extend to Firebase later)  
- **Voice Coach**: reads hints and story out loud using the **Web Speech API**  
- **Live “Valid Code” Highlighting**: lines like `move(3)` turn **green** while typing ✅

---
###########################################################################################################

Hint: Play Smart!

Try to use loops to reduce the number of move commands you write.
This helps you think like a real programmer and keeps your code clean.

For example:

for i in range(6):
    move(1)


The above code is equivalent to writing move(6), but it shows how loops work by repeating a small action multiple times.

###########################################################################################################
## 🚀 Run Locally

### Option A: Open it directly
Just open `index.html` in Chrome.

### Option B (recommended): run a local server
```bash
python -m http.server 8000
