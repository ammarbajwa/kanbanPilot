"use client";

import { useMemo, useState } from "react";

type Status = "backlog" | "active" | "review" | "done";

type Task = {
  id: string;
  status: Status;
  title: string;
  body: string;
  tag: string;
};

const columns: { id: Status; title: string }[] = [
  { id: "backlog", title: "Backlog" },
  { id: "active", title: "Active" },
  { id: "review", title: "Review" },
  { id: "done", title: "Done" },
];

const initialTasks: Task[] = [
  {
    id: "task-1",
    status: "backlog",
    title: "Define pilot workflow",
    body: "Capture columns, entry criteria, and exit criteria for the first team board.",
    tag: "Planning",
  },
  {
    id: "task-2",
    status: "active",
    title: "Sketch task card model",
    body: "Start with title, owner, priority, due date, and short notes before adding automation.",
    tag: "Product",
  },
  {
    id: "task-3",
    status: "review",
    title: "Review board interactions",
    body: "Validate drag-and-drop behavior on desktop and mobile layouts.",
    tag: "UX",
  },
  {
    id: "task-4",
    status: "done",
    title: "Create initial repository",
    body: "Set up the project with a simple runnable board and baseline documentation.",
    tag: "Setup",
  },
];

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<Status | null>(null);

  const counts = useMemo(
    () =>
      columns.map((column) => ({
        ...column,
        count: tasks.filter((task) => task.status === column.id).length,
      })),
    [tasks],
  );

  function addTask() {
    setTasks((currentTasks) => [
      {
        id: `task-${Date.now()}`,
        status: "backlog",
        title: `New pilot task ${currentTasks.length + 1}`,
        body: "Refine this task once the next workflow detail is known.",
        tag: "New",
      },
      ...currentTasks,
    ]);
  }

  function moveTask(taskId: string, status: Status) {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId ? { ...task, status } : task,
      ),
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Pilot board</p>
          <h1>kanbanPilot</h1>
        </div>
        <button type="button" onClick={addTask}>
          Add task
        </button>
      </header>

      <section className="metrics" aria-label="Board summary">
        {counts.map((column) => (
          <div className="metric" key={column.id}>
            <span>{column.title}</span>
            <strong>{column.count}</strong>
          </div>
        ))}
      </section>

      <section className="board" aria-label="Kanban board">
        {columns.map((column) => (
          <div
            className={`column ${dragTarget === column.id ? "drag-over" : ""}`}
            data-status={column.id}
            key={column.id}
            onDragLeave={() => setDragTarget(null)}
            onDragOver={(event) => {
              event.preventDefault();
              setDragTarget(column.id);
            }}
            onDrop={(event) => {
              event.preventDefault();
              const taskId = event.dataTransfer.getData("text/plain");
              if (taskId) {
                moveTask(taskId, column.id);
              }
              setDraggingTaskId(null);
              setDragTarget(null);
            }}
          >
            <h2>{column.title}</h2>
            <div className="task-list">
              {tasks
                .filter((task) => task.status === column.id)
                .map((task) => (
                  <article
                    className={`task-card ${
                      draggingTaskId === task.id ? "dragging" : ""
                    }`}
                    draggable
                    key={task.id}
                    onDragEnd={() => {
                      setDraggingTaskId(null);
                      setDragTarget(null);
                    }}
                    onDragStart={(event) => {
                      setDraggingTaskId(task.id);
                      event.dataTransfer.setData("text/plain", task.id);
                    }}
                  >
                    <h3>{task.title}</h3>
                    <p>{task.body}</p>
                    <span className="tag">{task.tag}</span>
                  </article>
                ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

