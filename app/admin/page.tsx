import QueueBoard from "@/components/admin/QueueBoard";
import QueueCounters from "@/components/admin/QueueCounters";

export default function AdminQueuePage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-[-0.02em]">Print queue</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Review submissions, queue approved keychains and track them through the printers.
        </p>
      </div>
      <QueueCounters />
      <QueueBoard />
    </div>
  );
}
