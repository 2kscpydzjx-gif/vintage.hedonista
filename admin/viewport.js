/* Keep fixed admin controls inside the visible viewport when a mobile keyboard opens. */
(()=>{'use strict';
 const viewport=window.visualViewport,compact=matchMedia('(max-width:1199px)');if(!viewport)return;
 const style=document.documentElement.style;let pending=false;
 function paint(){
  pending=false;const enabled=compact.matches&&Math.abs(viewport.scale-1)<.01;
  const values=enabled?{'--admin-visible-height':Math.round(viewport.height)+'px','--admin-viewport-top':Math.round(viewport.offsetTop)+'px','--admin-keyboard-gap':Math.max(0,Math.round(document.documentElement.clientHeight-viewport.height-viewport.offsetTop))+'px'}:{};
  for(const key of ['--admin-visible-height','--admin-viewport-top','--admin-keyboard-gap']){const value=values[key]||'';if(style.getPropertyValue(key)!==value){if(value)style.setProperty(key,value);else style.removeProperty(key)}}
 }
 function schedule(){if(pending)return;pending=true;requestAnimationFrame(paint)}
 viewport.addEventListener('resize',schedule);viewport.addEventListener('scroll',schedule);window.addEventListener('resize',schedule);compact.addEventListener('change',schedule);paint();
})();
