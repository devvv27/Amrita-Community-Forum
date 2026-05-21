import AIChatBot from "../components/AIChatBot";

export default function AIChatPage() {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">AI Chatbot</h1>
          <p className="text-sm text-text/60 mt-1">Ask questions about code, tasks, or the project.</p>
        </div>
      </div>

      <div>
        <AIChatBot />
      </div>
    </section>
  );
}
