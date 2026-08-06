import Image from "next/image";
import Link from "next/link";
export function Logo() {
  return <Link href="/marketplace" className="logo" aria-label="Cuồng tai nghe TWS Market"><span className="logo-mark"><Image src="/brand/earbuds-icon.png" alt="" width={36} height={36} priority /></span><span><strong>Cuồng tai nghe TWS</strong><small>community market</small></span></Link>;
}
