import { runAsWorker } from "synckit";

runAsWorker(async (modulePath) => ({...await import(modulePath)}));
