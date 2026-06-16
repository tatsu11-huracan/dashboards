type Props = {
  title: string;
  subtitle: string;
};

export default function DashboardHeader({ title, subtitle }: Props) {
  return (
    <header className="bg-white border border-gray-200 rounded-lg px-5 py-4">
      <h1 className="text-xl font-bold text-gray-900">{title}</h1>
      <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
    </header>
  );
}
