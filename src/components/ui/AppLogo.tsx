import Image from "next/image";
import styles from "./AppLogo.module.css";

interface AppLogoProps {
  height?: number;
  className?: string;
}

export default function AppLogo({ height = 28, className }: AppLogoProps) {
  return (
    <Image
      src="/logo.png"
      alt="Duobingo"
      width={Math.round(height * 4.2)}
      height={height}
      className={`${styles.logo} ${className ?? ""}`}
      priority
    />
  );
}
