import { execSync, ExecSyncOptionsWithStringEncoding } from "child_process";
import { ReviewTarget } from "./config.js"; // Ensure .js for ESM NodeNext

export function getGitDiff(target: ReviewTarget, baseBranch?: string): string {
  const execOptions: ExecSyncOptionsWithStringEncoding = {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024, // Increased to 20MB buffer
    stdio: ["pipe", "pipe", "pipe"], // pipe stderr to catch git errors
  };

  let command: string = "";

  try {
    // Verify it's a git repository first
    execSync("git rev-parse --is-inside-work-tree", {
      ...execOptions,
      stdio: "ignore",
    });
  } catch (error) {
    console.error(
      "[MCP Server Git] Current directory is not a git repository or git is not found."
    );
    throw new Error(
      "Execution directory is not a git repository or git command is not available. Please run from a git project root."
    );
  }

  try {
    switch (target) {
      case "staged":
        command = "git diff --staged --patch-with-raw --unified=10"; // More context
        break;
      case "HEAD":
        command = "git diff HEAD --patch-with-raw --unified=10";
        break;
      case "branch_diff":
        if (!baseBranch || baseBranch.trim() === "") {
          throw new Error(
            "Base branch/commit is required for 'branch_diff' target and cannot be empty."
          );
        }
        // Sanitize baseBranch somewhat to prevent trivial command injection if it were ever less controlled.
        // For now, it's from Claude Code arguments, so less risky but good practice.
        const sanitizedBaseBranch = baseBranch.replace(
          /[^a-zA-Z0-9_.\-/]/g,
          ""
        );
        if (sanitizedBaseBranch !== baseBranch) {
          throw new Error("Invalid characters in base branch name.");
        }
        // Fetch the base branch to ensure the diff is against the latest version of it
        // Use --no-tags to avoid fetching unnecessary data
        // Redirect stderr to /dev/null (or NUL on windows) to suppress verbose fetch output if not an error
        const fetchCommand = `git fetch origin ${sanitizedBaseBranch}:${sanitizedBaseBranch} --no-tags --quiet`;
        try {
          execSync(fetchCommand, execOptions);
        } catch (fetchError: any) {
          // Log a warning but proceed; the branch might be local or already up-to-date
          console.warn(
            `[MCP Server Git] Warning during 'git fetch' for base branch '${sanitizedBaseBranch}': ${fetchError.message}. Diff will proceed with local state.`
          );
        }
        command = `git diff ${sanitizedBaseBranch}...HEAD --patch-with-raw --unified=10`;
        break;
      default:
        // This case should ideally be caught by Zod validation on parameters
        throw new Error(`Unsupported git diff target: ${target}`);
    }

    console.log(`[MCP Server Git] Executing: ${command}`);
    const diffOutput = execSync(command, execOptions);

    if (!diffOutput.trim()) {
      return "No changes found for the specified target.";
    }
    return diffOutput;
  } catch (error: any) {
    const errorMessage =
      error.stderr?.toString().trim() || error.message || "Unknown git error";
    console.error(
      `[MCP Server Git] Error getting git diff for target "${target}" (base: ${
        baseBranch || "N/A"
      }):`
    );
    console.error(`[MCP Server Git] Command: ${command || "N/A"}`);
    console.error(
      `[MCP Server Git] Stderr: ${error.stderr?.toString().trim()}`
    );
    console.error(
      `[MCP Server Git] Stdout: ${error.stdout?.toString().trim()}`
    );
    throw new Error(
      `Failed to get git diff. Git error: ${errorMessage}. Ensure you are in a git repository and the target/base is valid.`
    );
  }
}
