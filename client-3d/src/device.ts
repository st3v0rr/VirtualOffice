// coarse pointer (touch) devices: phones and tablets
export const isTouchDevice =
  typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
