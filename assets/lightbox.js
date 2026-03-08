(() => {
  const triggers = Array.from(document.querySelectorAll(".lightbox-trigger"));
  if (!triggers.length) return;

  const overlay = document.createElement("div");
  overlay.className = "lightbox-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="lightbox-shell" role="dialog" aria-modal="true" aria-label="Image preview">
      <button class="lightbox-close" type="button" aria-label="Close image preview">&times;</button>
      <div class="lightbox-stage">
        <img class="lightbox-image" alt="" />
      </div>
      <p class="lightbox-caption"></p>
    </div>
  `;
  document.body.appendChild(overlay);

  const dialog = overlay.querySelector(".lightbox-shell");
  const closeButton = overlay.querySelector(".lightbox-close");
  const image = overlay.querySelector(".lightbox-image");
  const caption = overlay.querySelector(".lightbox-caption");
  let lastTrigger = null;

  function open(trigger) {
    const thumb = trigger.querySelector("img");
    image.src = trigger.href;
    image.alt = thumb ? thumb.alt : "";
    caption.textContent = trigger.dataset.lightboxCaption || (thumb ? thumb.alt : "");
    overlay.hidden = false;
    document.body.classList.add("lightbox-open");
    closeButton.focus();
    lastTrigger = trigger;
  }

  function close() {
    if (overlay.hidden) return;
    overlay.hidden = true;
    image.removeAttribute("src");
    image.alt = "";
    caption.textContent = "";
    document.body.classList.remove("lightbox-open");
    if (lastTrigger) lastTrigger.focus();
  }

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      open(trigger);
    });
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || !dialog.contains(event.target)) {
      close();
      return;
    }

    if (event.target.classList.contains("lightbox-stage")) {
      close();
    }
  });

  closeButton.addEventListener("click", close);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      close();
    }
  });
})();
