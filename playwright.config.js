import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const MESA_EGL = "/usr/share/glvnd/egl_vendor.d/50_mesa.json";
const webkitLaunchOptions = existsSync(MESA_EGL)
	? {
			env: {
				...process.env,
				__EGL_VENDOR_LIBRARY_FILENAMES: MESA_EGL,
				LIBGL_ALWAYS_SOFTWARE: "1",
			},
		}
	: undefined;

export default defineConfig({
	testDir: "./test/browser",
	fullyParallel: true,
	projects: [
		{ name: "chromium", use: { ...devices["Desktop Chrome"] } },
		{ name: "firefox", use: { ...devices["Desktop Firefox"] } },
		{
			name: "webkit",
			use: {
				...devices["Desktop Safari"],
				...(webkitLaunchOptions ? { launchOptions: webkitLaunchOptions } : {}),
			},
		},
	],
	reporter: "line",
});
