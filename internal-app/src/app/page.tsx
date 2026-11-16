import { Button } from "@astryxdesign/core/Button";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center-safe justify-center-safe gap-4 p-6">
      <h1>内部子应用</h1>
      <Button label="Astryx 按钮" variant="primary" />
    </main>
  );
}
