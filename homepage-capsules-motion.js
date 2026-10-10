
/* STEP 50: scroll reveal for capsule editorial; disabled for reduced motion. */
(()=>{
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const section=document.querySelector('.homepage-capsules');if(!section)return;
 section.classList.add('vh-capsules-reveal');
 if(!('IntersectionObserver' in window)){section.classList.add('is-visible');return;}
 const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target)}},{threshold:.12});
 observer.observe(section);
})();
