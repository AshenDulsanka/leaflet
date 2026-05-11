// Polyfill missing Web Animations API hooks used by Svelte transitions in jsdom.
if (typeof Element !== 'undefined' && !Element.prototype.animate) {
  Element.prototype.animate = function animate(): Animation {
    const noop = () => undefined;

    return {
      cancel: noop,
      finish: noop,
      play: noop,
      pause: noop,
      reverse: noop,
      updatePlaybackRate: noop,
      addEventListener: noop,
      removeEventListener: noop,
      dispatchEvent: () => true,
      commitStyles: noop,
      persist: noop,
      oncancel: null,
      onfinish: null,
      onremove: null,
      currentTime: 0,
      effect: null,
      finished: Promise.resolve(),
      id: '',
      pending: false,
      playState: 'finished',
      playbackRate: 1,
      ready: Promise.resolve(),
      replaceState: 'active',
      startTime: 0,
      timeline: null,
    } as unknown as Animation;
  };
}