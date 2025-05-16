import { execSync, ExecSyncOptionsWithStringEncoding } from "child_process";
import { ReviewTarget, isDebugMode } from "./config.js"; // Ensure .js for ESM NodeNext

/**
 * Gets the git diff for the specified target.
 * 
 * @param target - The git target to review ('staged', 'HEAD', or 'branch_diff')
 * @param baseBranch - For 'branch_diff' target, the base branch/commit to compare against
 * @returns The git diff as a string or a message if no changes are found
 * @throws Error if not in a git repository, or if git encounters any errors
 * 
 * Note: For branch_diff, this function assumes the remote is named 'origin'.
 * If your repository uses a different remote name, this operation may fail.
 */
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
        // Sanitize baseBranch to prevent command injection
        // Only allow alphanumeric characters, underscore, dash, dot, and forward slash
        const sanitizedBaseBranch = baseBranch.replace(
          /[^a-zA-Z0-9_.\-/]/g,
          ""
        );
        if (sanitizedBaseBranch !== baseBranch) {
          throw new Error(
            `Invalid characters in base branch name. Only alphanumeric characters, underscore, dash, dot, and forward slash are allowed. Received: "${baseBranch}"`
          );
        }
        // Fetch the base branch to ensure the diff is against the latest version of it
        // Note: This assumes the remote is named 'origin'
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

    // Only log the command if in debug mode
    if (isDebugMode()) {
      console.log(`[MCP Server Git] Executing: ${command}`);
    }
    
    // Execute the command (execOptions has encoding:'utf8' so the result should already be a string)
    const diffOutput = execSync(command, execOptions);
    
    // Ensure we always have a string to work with
    // This is for type safety and to handle any unexpected Buffer return types
    const diffString = Buffer.isBuffer(diffOutput) ? diffOutput.toString('utf8') : String(diffOutput);
    
    if (!diffString.trim()) {
      return "No changes found for the specified target.";
    }
    return diffString;
  } catch (error: any) {
    const errorMessage =
      error.stderr?.toString().trim() || error.message || "Unknown git error";
    console.error(
      `[MCP Server Git] Error getting git diff for target "${target}" (base: ${
        baseBranch || "N/A"
      }):`
    );
    console.error(`[MCP Server Git] Command: ${command || "N/A"}`);
    
    // Only log the full error details in debug mode
    if (isDebugMode()) {
      console.error(
        `[MCP Server Git] Stderr: ${error.stderr?.toString().trim()}`
      );
      console.error(
        `[MCP Server Git] Stdout: ${error.stdout?.toString().trim()}`
      );
    }
    
    throw new Error(
      `Failed to get git diff. Git error: ${errorMessage}. Ensure you are in a git repository and the target/base is valid.`
    );
  }
}