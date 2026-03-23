import { getBundles } from '@utils/api';
import { GetBundlesFilterParams } from "../types";

async function main() {
  const filters: GetBundlesFilterParams = {
    orderIds: [
      "0x1de2b313190635f79db163c4065d320a5cae5f11207c4bd09281d3aa5f999c8b",
      "0x5b8eec906382cf09fef3a9f23f3f797542e26642d9f26e0df1822dc31778ee17",
      "0x87fee54315f6f8da643d91726ae076442e78721562a67c2aff0803ac8b91767d",
      "0x5751aee2e5e8afd18d9196f7a9887122dc24bb190f0816cdf08dff4bdba25af7",
      "0x6313f109e24ca5a7215effebb560eee7c7f106596534996ff63413d92f8219f2",
      "0x39e1f9c8050b8ce0e0139366bd48418afa7f03630fc697727da7936a344c79da",
      "0x0a905911068ee781a4c5dc0dab8f73aa4c3a015ce8c8fc67c8c9d1cd76412c4e",
      "0x67c0ca196ce0c8f78d5dafad8543a895073e18724b1ca5afb98cfd276f1f2de7",
    ],
    createdFrom: "2025-11-15T00:00:00Z",
    createdTo: "2025-12-31T23:59:59Z",
    sort: "-createdAt",
    page: 1,
    pageSize: 25,
  };

  console.log("Fetching bundles by underlying orderIds...");
  const res = await getBundles(filters);

  console.log("\n✅ Bundles fetched successfully:", JSON.stringify(res, null, 2));
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});