(function () {
  const promo = document.getElementById('fullscreen-promo');
  const image = document.getElementById('fullscreen-promo-image');
  if (!promo || !image) return;

  const pricePage = document.querySelectorAll('.header-bar, .main-container, .admin-entry-link');
  let started = false;

  function startRotation() {
    if (started || !image.naturalWidth) return;
    started = true;
    window.setInterval(() => {
      const visible = document.body.classList.toggle('promo-visible');
      promo.setAttribute('aria-hidden', String(!visible));
      pricePage.forEach((element) => {
        element.inert = visible;
      });
    }, 5000);
  }

  if (image.complete) {
    startRotation();
  } else {
    image.addEventListener('load', startRotation, { once: true });
  }
})();
