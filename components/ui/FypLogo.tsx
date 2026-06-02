export default function FypLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="10" fill="#1565FF"/>
      <path d="M10 10L10 30L14 30L14 22L22 22L22 18L14 18L14 14L24 14L24 10Z" fill="white" opacity="0.95"/>
      <path d="M20 14L20 26L24 26L24 22C27 22 30 20 30 18C30 16 27 14 24 14Z" fill="white" opacity="0.7"/>
    </svg>
  )
}
