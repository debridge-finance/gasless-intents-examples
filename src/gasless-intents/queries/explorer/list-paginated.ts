import { listExplorerBundles } from "@utils/api";
import { ExplorerListFilterParams } from "../../explorer.types";
import { savePayload } from "./_savePayload";

async function main() {
  const baseFilters: ExplorerListFilterParams = {
    q: "0x55A8f5cce1d53D9Ff84EC0962882b447E5914dB8",
    limit: 5,
  };

  console.log("Page 1 via page=1...");
  const page1 = await listExplorerBundles({ ...baseFilters, page: 1 });

  console.log("Page 2 via afterCursor=5 (offset)...");
  const page2 = await listExplorerBundles({ ...baseFilters, afterCursor: 5 });

  const combined = { page1, page2 };
  const path = savePayload("list-paginated", combined);

  console.log(
    `\n✅ Saved: page1 ${page1.data.length}/${page1.meta.total}, ` +
      `page2 ${page2.data.length}/${page2.meta.total} → ${path}`,
  );
  console.log(JSON.stringify(combined, null, 2));
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
