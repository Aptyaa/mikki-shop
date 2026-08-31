/** Inline message strip. */
export interface NoticeProps {
  tone?: "info" | "success" | "warning" | "danger" | "brand";
  title?: React.ReactNode;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export function Notice(props: NoticeProps): JSX.Element;
