// The behaviour of the design system's SiteHeader and SiteFooter, which their static markup in index.html
// does not carry: the EU banner's "How do you know?" button, and the footer's "Back to top" button.

(() => {
  const toggle = document.querySelector('.ted-globan__toggle');
  const dropdown = toggle && document.getElementById(toggle.getAttribute('aria-controls'));
  if (toggle && dropdown) {
    const show = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      dropdown.hidden = !open;
    };
    toggle.addEventListener('click', () => show(dropdown.hidden));
    // Escape closes the explanation and gives the focus back to the button. A click elsewhere leaves it
    // open, as on the live sites. An Escape that something else, such as the editor's suggestions,
    // already handled is left alone.
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !event.defaultPrevented && !dropdown.hidden) {
        show(false);
        toggle.focus();
      }
    });
  }

  const backToTop = document.querySelector('footer button[aria-label="Back to top"]');
  if (backToTop) {
    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // Move the focus too, or keyboard users stay at the bottom.
      const header = document.querySelector('header');
      const target = header && [...header.querySelectorAll('a[href], button')].find((el) => el.getClientRects().length);
      if (target) {
        target.focus({ preventScroll: true });
      }
    });
  }
})();
