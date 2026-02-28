export const devopsTopics = [
  {
    name: "Linux",
    count: 14,
    summary: "systemd, journald, users, disks, troubleshooting",
  },
  {
    name: "Docker",
    count: 9,
    summary: "images, compose, registries, layer cache",
  },
  {
    name: "Сети",
    count: 11,
    summary: "dns, routing, nat, tcpdump, vpn",
  },
  {
    name: "Ansible",
    count: 7,
    summary: "roles, inventories, templates, idempotency",
  },
  {
    name: "K8S",
    count: 12,
    summary: "pods, ingress, helm, probes, stateful workloads",
  },
  {
    name: "Terraform",
    count: 8,
    summary: "state, modules, providers, plans, drift",
  },
  {
    name: "CI/CD",
    count: 10,
    summary: "pipelines, runners, release flow, artifacts",
  },
];

export const devopsArticles = [
  {
    title: "Docker image size audit",
    topic: "Docker",
    level: "Практика",
    updatedAt: "сегодня",
    summary: "Как быстро находить тяжелые слои, чистить build context и не тащить лишнее в runtime image.",
  },
  {
    title: "Systemd unit patterns",
    topic: "Linux",
    level: "База",
    updatedAt: "вчера",
    summary: "Шаблоны сервисов, restart policy, env files и быстрый дебаг через journalctl.",
  },
  {
    title: "Kubernetes probes without pain",
    topic: "K8S",
    level: "Разбор",
    updatedAt: "2 дня назад",
    summary: "Когда readiness и liveness помогают, а когда сами становятся причиной падений.",
  },
  {
    title: "Terraform state checklist",
    topic: "Terraform",
    level: "Шпаргалка",
    updatedAt: "3 дня назад",
    summary: "Remote backend, lock, import, state mv, state rm и порядок действий перед refactor.",
  },
];

export const featuredArticle = {
  title: "Docker image size audit",
  topic: "Docker",
  readingTime: "6 мин",
  summary:
    "Эта заметка нужна, когда образ неожиданно вырос, pull стал медленным, а pipeline начал тратить время не на сборку, а на передачу лишних мегабайт.",
  paragraphs: [
    "Сначала смотри на образ как на набор слоев. Рост обычно приходит не из одного большого файла, а из нескольких привычных решений: копирование всего репозитория, кеши пакетных менеджеров, dev-зависимости и временные артефакты.",
    "Рабочий порядок простой: проверить build context, разнести build и runtime по multi-stage, закрепить базовый образ и смотреть diff размера после каждого шага. Главное не оптимизировать вслепую, а фиксировать, какой слой дал прирост.",
  ],
  commands: [
    "docker image ls",
    "docker history my-app:latest",
    "docker build --no-cache -t my-app:debug .",
  ],
  checklist: [
    "Есть `.dockerignore` без мусора из `.git`, `node_modules`, логов и артефактов",
    "Build stage и runtime stage разделены",
    "В финальный образ не попадают package manager caches",
    "Тяжелые утилиты остаются только в build stage",
  ],
};
