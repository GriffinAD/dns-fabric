<script lang="ts">
  import Button from "flowbite-svelte/Button.svelte";
  import House from "lucide-svelte/icons/house";

  import { UI_VERSION } from "./lib/uiVersion";
</script>

<main class="min-h-screen bg-gray-50 p-8 dark:bg-gray-900">
  <div class="mx-auto flex max-w-lg flex-col gap-4">
    <h1 class="flex items-center gap-2 text-2xl font-semibold text-gray-900 dark:text-white">
      <House class="h-8 w-8 shrink-0" aria-hidden="true" />
      Kea Fabric
    </h1>
    <p class="text-gray-600 dark:text-gray-400">
      Operator shell bootstrap ({UI_VERSION}). Flowbite Svelte v2 + Tailwind v4.
    </p>
    <div>
      <Button>Primary action</Button>
    </div>
  </div>
</main>
