// The demo video's chapter list, from media/chapters.json (written by video/assemble.py).
// Clicking a chapter seeks the video; the chapter playing now is marked.
const video = document.getElementById("video");
const list = document.getElementById("chapters");
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

fetch("media/chapters.json")
  .then((r) => r.json())
  .then((chapters) => {
    for (const c of chapters) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.start = c.start;
      const t = document.createElement("time");
      t.textContent = clock(c.start);
      const name = document.createElement("span");
      name.textContent = c.title;
      b.append(t, name);
      b.addEventListener("click", () => { video.currentTime = c.start + 0.05; video.play(); });
      const li = document.createElement("li");
      li.append(b);
      list.append(li);
    }
    video.addEventListener("timeupdate", () => {
      const buttons = [...list.querySelectorAll("button")];
      let now = buttons[0];
      for (const b of buttons) if (video.currentTime >= Number(b.dataset.start)) now = b;
      for (const b of buttons) b.setAttribute("aria-current", String(b === now));
    });
  })
  .catch(() => { list.parentElement.hidden = true; });
