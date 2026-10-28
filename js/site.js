// Header navigation: Part B DME dropdown + mobile menu toggle
(function () {
  document.querySelectorAll('[data-dropdown]').forEach(function (wrapper) {
    var button = wrapper.querySelector('button');
    var menu = wrapper.querySelector('.nav__dropdown');

    function setOpen(open) {
      button.setAttribute('aria-expanded', String(open));
      if (open) menu.setAttribute('data-open', '');
      else menu.removeAttribute('data-open');
    }

    button.addEventListener('click', function () {
      setOpen(button.getAttribute('aria-expanded') !== 'true');
    });
    wrapper.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { setOpen(false); button.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (!wrapper.contains(e.target)) setOpen(false);
    });
    wrapper.addEventListener('focusout', function (e) {
      if (!wrapper.contains(e.relatedTarget)) setOpen(false);
    });
  });

  var toggle = document.querySelector('.nav-toggle');
  var mobileMenu = document.getElementById('mobile-menu');
  if (toggle && mobileMenu) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      if (open) mobileMenu.setAttribute('data-open', '');
      else mobileMenu.removeAttribute('data-open');
    });
  }
})();
