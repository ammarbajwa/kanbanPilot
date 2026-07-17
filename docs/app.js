const tasks = [
  {
    id: "task-1",
    status: "backlog",
    title: "Define pilot workflow",
    body: "Capture the columns, entry criteria, and exit criteria for the first team board.",
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

const lists = document.querySelectorAll("[data-list]");
const addTaskButton = document.querySelector("#addTask");

function renderTasks() {
  lists.forEach((list) => {
    list.innerHTML = "";
    tasks
      .filter((task) => task.status === list.dataset.list)
      .forEach((task) => {
        const card = document.createElement("article");
        card.className = "task-card";
        card.draggable = true;
        card.dataset.taskId = task.id;
        card.innerHTML = `
          <h3>${task.title}</h3>
          <p>${task.body}</p>
          <span class="tag">${task.tag}</span>
        `;
        list.appendChild(card);
      });
  });
}

document.addEventListener("dragstart", (event) => {
  const card = event.target.closest(".task-card");
  if (!card) return;
  event.dataTransfer.setData("text/plain", card.dataset.taskId);
});

lists.forEach((list) => {
  list.addEventListener("dragover", (event) => {
    event.preventDefault();
    list.classList.add("drag-over");
  });

  list.addEventListener("dragleave", () => {
    list.classList.remove("drag-over");
  });

  list.addEventListener("drop", (event) => {
    event.preventDefault();
    list.classList.remove("drag-over");
    const taskId = event.dataTransfer.getData("text/plain");
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    task.status = list.dataset.list;
    renderTasks();
  });
});

addTaskButton.addEventListener("click", () => {
  const nextTaskNumber = tasks.length + 1;
  tasks.unshift({
    id: `task-${Date.now()}`,
    status: "backlog",
    title: `New pilot task ${nextTaskNumber}`,
    body: "Refine this task once the next workflow detail is known.",
    tag: "New",
  });
  renderTasks();
});

renderTasks();

