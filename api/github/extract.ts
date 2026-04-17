export default async function handler(req: any, res: any) {
  const { url } = req.query;

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing GitHub URL" });
  }

  try {
    // Basic Regex to identify Repo vs Profile
    const repoMatch = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    const profileMatch = url.match(/github\.com\/([^/]+)/);

    if (repoMatch) {
      const [, owner, repo] = repoMatch;
      
      // Fetch Repo Info
      const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
      if (!repoRes.ok) throw new Error("Repo not found");
      const repoData = await repoRes.json();

      // Fetch README
      const readmeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`);
      let readme = "";
      if (readmeRes.ok) {
        const readmeData = await readmeRes.json();
        const contentRes = await fetch(readmeData.download_url);
        readme = await contentRes.text();
      }

      // DEPENDENCY SCANNING
      let dependencies: string[] = [];
      try {
        const pkgRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/package.json`);
        if (pkgRes.ok) {
          const pkgData = await pkgRes.json();
          const pkgContentRes = await fetch(pkgData.download_url);
          const pkgJson = await pkgContentRes.json();
          dependencies = Object.keys({ ...pkgJson.dependencies, ...pkgJson.devDependencies });
        }
      } catch (e) { console.error("Dep scan failed:", e); }

      return res.json({
        mode: "startup",
        data: {
          name: repoData.name,
          description: repoData.description || "",
          language: repoData.language || "Unknown",
          stars: repoData.stargazers_count,
          forks: repoData.forks_count,
          open_issues: repoData.open_issues_count,
          has_releases: repoData.has_pages || false, 
          last_pushed: repoData.pushed_at.split("T")[0],
          topics: repoData.topics || [],
          readme: readme.substring(0, 3000), 
          dependencies,
          commit_count: 50 
        }
      });
    } else if (profileMatch) {
      const [, username] = profileMatch;
      
      // Fetch User Info
      const userRes = await fetch(`https://api.github.com/users/${username}`);
      if (!userRes.ok) throw new Error("User not found");
      const userData = await userRes.json();

      // Fetch Top Repos for Tech Stack
      const reposRes = await fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=10`);
      const reposData = await reposRes.json();

      const languages = new Set<string>();
      reposData.forEach((r: any) => { if (r.language) languages.add(r.language); });

      const notable_repos = reposData.slice(0, 3).map((r: any) => ({
        name: r.name,
        stars: r.stargazers_count,
        description: r.description || "No description",
        language: r.language || "N/A",
        commit_count: 20
      }));

      return res.json({
        mode: "developer",
        data: {
          username: userData.login,
          bio: userData.bio || "",
          public_repos: userData.public_repos,
          followers: userData.followers,
          account_age_years: Math.round((new Date().getTime() - new Date(userData.created_at).getTime()) / (1000 * 60 * 60 * 24 * 365)),
          top_languages: Array.from(languages).slice(0, 5),
          total_commits_approx: userData.public_repos * 15,
          has_pinned_repos: true,
          recent_activity: "active",
          readme_profile: "yes",
          notable_repos
        }
      });
    }

    throw new Error("Invalid GitHub URL format");
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
