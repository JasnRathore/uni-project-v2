# Image fallback helper

## Purpose and exports

`ImageWithFallback` wraps an HTML image and displays a built-in SVG placeholder after the original image errors. Named export; it accepts standard `React.ImgHTMLAttributes<HTMLImageElement>` props.

## State, route, data, and interaction

Local boolean state remembers an image load error. There is no app route or backend dependency; no in-repository use was found. A successful initial source renders an `<img>` with provided source, alt, class and style; after error, a placeholder SVG is rendered and the original URL is retained as `data-original-url`.

## Loading/error/empty, responsive/accessibility, side effects

No loading state or retry behavior. The fallback container inherits class/style but its nested placeholder image uses alt text “Error loading image” rather than the caller-provided alt; assistive-technology treatment of the original image context is therefore not equivalent. Responsive sizing comes only from forwarded caller classes/styles.

## Source references

Source: `components/figma/ImageWithFallback.tsx`. The path is included as an app-local helper; it is not generated build output or a vendored dependency module.
