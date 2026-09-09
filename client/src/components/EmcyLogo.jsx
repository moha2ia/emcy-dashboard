const LOGO_FULL = '/emcy-logo.png';
const LOGO_ICON = '/emcy-logo-icon.png';

const styles = {
  full: { height: 56, width: 'auto', maxWidth: 220, objectFit: 'contain', display: 'block' },
  compact: { height: 32, width: 'auto', maxWidth: 140, objectFit: 'contain', display: 'block' },
  icon: { height: 40, width: 'auto', objectFit: 'contain', display: 'block' },
};

export default function EmcyLogo({ variant = 'full', style = {} }) {
  const src = variant === 'icon' ? LOGO_ICON : LOGO_FULL;

  return (
    <img
      src={src}
      alt="EMCY"
      style={{ ...styles[variant], ...style }}
    />
  );
}
