const normalizedPublicUrl = (() => {
  const publicUrl = process.env.PUBLIC_URL || '.';
  const trimmed = publicUrl.replace(/\/+$/, '');
  return trimmed || '.';
})();

export const assetUrl = (relativePath = '') => {
  const cleanPath = String(relativePath).replace(/^\/+/, '');
  return `${normalizedPublicUrl}/${cleanPath}`;
};

export const spriteHref = (iconId) => `${assetUrl('sprites.svg')}#${iconId}`;

export const backgroundImageStyle = (relativePath) => ({
  backgroundImage: `url("${assetUrl(relativePath)}")`,
});
