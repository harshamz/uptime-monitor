type Props = { text: string; type: 'success' | 'error' };

export default function Toast({ text, type }: Props) {
  return <div className={`toast ${type}`}>{text}</div>;
}
