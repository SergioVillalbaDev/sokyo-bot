// Une clases condicionales ignorando valores vacíos/falsy.
export const cn = (...classes) => classes.filter(Boolean).join(' ');
