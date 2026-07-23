import { MiniRoi } from "./MiniRoi";

export function RoiCell({ value }: { value: number }) {
  return <MiniRoi value={value} emphasis />;
}
