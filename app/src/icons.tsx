// Icon set ported 1:1 from the Attendance App design mockup (Claude Design "Modernist" system).
import type { ReactElement, SVGProps } from 'react';

function Svg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block' }}
      {...props}
    />
  );
}

export const HomeIcon = () => <Svg><path d="M4 11 12 4l8 7" /><path d="M6 10v9h12v-9" /></Svg>;
export const ClockIcon = () => <Svg><circle cx={12} cy={12} r={9} /><path d="M12 7v5l3 3" /></Svg>;
export const CalendarIcon = () => <Svg><rect x={3} y={5} width={18} height={16} /><line x1={3} y1={10} x2={21} y2={10} /><line x1={8} y1={3} x2={8} y2={7} /><line x1={16} y1={3} x2={16} y2={7} /></Svg>;
export const ClipboardIcon = () => <Svg><rect x={5} y={4} width={14} height={17} /><rect x={9} y={2} width={6} height={4} /><line x1={8} y1={11} x2={16} y2={11} /><line x1={8} y1={15} x2={13} y2={15} /></Svg>;
export const UsersIcon = () => <Svg><circle cx={9} cy={8} r={3.2} /><path d="M3 20c0-3.2 2.7-5.5 6-5.5s6 2.3 6 5.5" /><circle cx={17} cy={9} r={2.2} /><path d="M17.5 12.2c2.3.5 3.5 2.4 3.5 4.8" /></Svg>;
export const UserIcon = () => <Svg><circle cx={12} cy={8} r={3.6} /><path d="M5 20c0-3.6 3-6 7-6s7 2.4 7 6" /></Svg>;
export const BellIcon = () => <Svg><path d="M6 10a6 6 0 0112 0c0 3 1 5 2 6H4c1-1 2-3 2-6Z" /><path d="M10 20a2 2 0 004 0" /></Svg>;
export const ChevronRightIcon = () => <Svg><path d="M9 5l7 7-7 7" /></Svg>;
export const ChevronLeftIcon = () => <Svg><path d="M15 5l-7 7 7 7" /></Svg>;
export const CheckIcon = () => <Svg><path d="M5 13l4 4 10-10" /></Svg>;
export const XIcon = () => <Svg><line x1={5} y1={5} x2={19} y2={19} /><line x1={19} y1={5} x2={5} y2={19} /></Svg>;
export const PlusIcon = () => <Svg><line x1={12} y1={4} x2={12} y2={20} /><line x1={4} y1={12} x2={20} y2={12} /></Svg>;
export const ArrowLeftIcon = () => <Svg><line x1={20} y1={12} x2={4} y2={12} /><path d="M10 6l-6 6 6 6" /></Svg>;
export const LogOutIcon = () => <Svg><rect x={4} y={4} width={10} height={16} /><path d="M20 12H10" /><path d="M16 8l4 4-4 4" /></Svg>;
export const SearchIcon = () => <Svg><circle cx={10} cy={10} r={7} /><line x1={20} y1={20} x2={15} y2={15} /></Svg>;
export const DownloadIcon = () => <Svg><path d="M12 3v12" /><path d="M7 11l5 5 5-5" /><line x1={4} y1={21} x2={20} y2={21} /></Svg>;
export const GiftIcon = () => <Svg><rect x={4} y={10} width={16} height={10} /><rect x={4} y={7} width={16} height={3} /><line x1={12} y1={7} x2={12} y2={20} /><path d="M12 7C10 4 6 5 6 7.5S9 9 12 7Z" /><path d="M12 7c2-3 6-2 6 .5S15 9 12 7Z" /></Svg>;
export const AwardIcon = () => <Svg><circle cx={12} cy={9} r={5.5} /><path d="M8 14l-2 7 6-3 6 3-2-7" /></Svg>;
export const AlertTriangleIcon = () => <Svg><path d="M12 4 2 20h20L12 4Z" /><line x1={12} y1={10} x2={12} y2={15} /><circle cx={12} cy={18} r={0.5} /></Svg>;
export const CheckCircleIcon = () => <Svg><circle cx={12} cy={12} r={9} /><path d="M8 12l3 3 5-6" /></Svg>;
export const SettingsIcon = () => <Svg><circle cx={12} cy={12} r={3} /><path d="M4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4" /></Svg>;
export const LockIcon = () => <Svg><rect x={5} y={11} width={14} height={9} /><path d="M8 11V7a4 4 0 018 0v4" /></Svg>;
export const GlobeIcon = () => <Svg><circle cx={12} cy={12} r={9} /><line x1={3} y1={12} x2={21} y2={12} /><path d="M12 3c2.5 2.5 3.5 6 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-6-3.5-9s1-6.5 3.5-9Z" /></Svg>;
export const HelpIcon = () => <Svg><circle cx={12} cy={12} r={9} /><path d="M9.5 9.5a2.5 2.5 0 115 0c0 1.5-2.5 2-2.5 4" /><circle cx={12} cy={17} r={0.5} /></Svg>;

export const NOTIF_ICONS: Record<string, () => ReactElement> = {
  checkCircle: CheckCircleIcon,
  alertTriangle: AlertTriangleIcon,
  clipboard: ClipboardIcon,
  clock: ClockIcon,
};
