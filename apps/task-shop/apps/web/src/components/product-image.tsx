type ProductImageProps = {
  alt: string;
  className?: string;
  image: string;
};

export function ProductImage({ alt, className = "", image }: ProductImageProps) {
  if (image.startsWith("/")) {
    return (
      <img
        className={`product-image ${className}`.trim()}
        src={image}
        alt={alt}
        loading="lazy"
        decoding="async"
        width="768"
        height="768"
      />
    );
  }

  return <span className={`product-emoji ${className}`.trim()}>{image}</span>;
}
