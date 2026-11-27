export const OVERLAY_SCROLLBAR_SCRIPT = `(function () {
  if (window.__abOverlayScroll) return;
  window.__abOverlayScroll = true;
  var style = document.createElement("style");
  style.id = "ab-overlay-scroll";
  style.textContent = "html,body,*{scrollbar-width:none!important}*::-webkit-scrollbar{width:0!important;height:0!important}.ab-float-scroll{position:fixed;right:3px;width:6px;border-radius:999px;background:color-mix(in srgb,CanvasText 46%,transparent);opacity:0;pointer-events:none;z-index:2147483646;transition:opacity 160ms ease;touch-action:none}.ab-float-scroll[data-on='true']{opacity:1;pointer-events:auto}";
  (document.head || document.documentElement).appendChild(style);
  var thumb = document.createElement("div");
  thumb.className = "ab-float-scroll";
  var timer = 0;
  var current = null;
  var drag = null;
  function isRoot(node) {
    return !node || node === document.scrollingElement || node === document.documentElement || node === document.body;
  }
  function place(node) {
    if (!node) {
      thumb.dataset.on = "false";
      return;
    }
    current = node;
    var view = isRoot(node) ? { top: 0, height: window.innerHeight } : node.getBoundingClientRect();
    var bar = Math.max(28, (node.clientHeight / node.scrollHeight) * view.height);
    var max = Math.max(0, view.height - bar);
    var range = node.scrollHeight - node.clientHeight;
    var y = view.top + (range > 0 ? (node.scrollTop / range) * max : 0);
    thumb.style.height = bar + "px";
    thumb.style.transform = "translateY(" + y + "px)";
    thumb.dataset.on = "true";
  }
  function reveal(node) {
    if (!node || node.scrollHeight <= node.clientHeight + 1) {
      if (!drag) thumb.dataset.on = "false";
      return;
    }
    place(node);
    if (drag) return;
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (!drag) thumb.dataset.on = "false";
    }, 700);
  }
  function mount() {
    if (document.body && !thumb.isConnected) document.body.appendChild(thumb);
  }
  document.addEventListener("scroll", function (event) {
    var target = event.target;
    if (!target || target === document || target === document.documentElement || target === document.body) {
      target = document.scrollingElement;
    }
    reveal(target);
  }, true);
  window.addEventListener("resize", function () {
    if (current) reveal(current);
  });
  thumb.addEventListener("pointerdown", function (event) {
    if (!current) return;
    drag = { y: event.clientY, top: current.scrollTop, node: current };
    thumb.setPointerCapture(event.pointerId);
    event.preventDefault();
    place(current);
  });
  thumb.addEventListener("pointermove", function (event) {
    if (!drag) return;
    var node = drag.node;
    var view = isRoot(node) ? window.innerHeight : node.getBoundingClientRect().height;
    var bar = Math.max(28, (node.clientHeight / node.scrollHeight) * view);
    var max = Math.max(1, view - bar);
    var range = node.scrollHeight - node.clientHeight;
    node.scrollTop = drag.top + ((event.clientY - drag.y) / max) * range;
    place(node);
  });
  function endDrag() {
    drag = null;
  }
  thumb.addEventListener("pointerup", endDrag);
  thumb.addEventListener("pointercancel", endDrag);
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();`;

export function overlayScrollbarMarkup(): string {
  return `<script>${OVERLAY_SCROLLBAR_SCRIPT}</script>`;
}
