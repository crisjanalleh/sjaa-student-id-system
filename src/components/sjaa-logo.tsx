import Image from "next/image";
import logo from "../../assets/main-logo-new.png";

export default function SjaaLogo({
  className,
  priority = false,
}: {
  className: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={logo}
      alt="San Jose Adventist Academy logo"
      width={logo.width}
      height={logo.height}
      className={className}
      priority={priority}
      unoptimized
    />
  );
}
