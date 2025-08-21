# Chronicle Dashboard - Final Design Questionnaire

## Purpose
This questionnaire captures final design preferences to create the definitive Chronicle Dashboard. Each question includes key insights from previous feedback rounds to guide responses.

---

## Section 1: Overall Layout & Architecture

### Q1: Sidebar Design & Behavior
**Previous Feedback:**
- V3 sidebar with collapsible filters was most comprehensive
- Filters should move up when collapsed (not fixed container)

**Your Final Preference:**
- [ ] Collapsible sidebar (220px) with collapsible filter section
- [ ] Fixed sidebar with preset filters only
- [ ] No sidebar - integrate everything into main view
- [x] Other: My preference here would be the collapsible sidebar with preset filters in the MVP. Then, as a future feature, adding a collapsible filter section like v3 into the sidebar.

### Q2: Header Layout & Components
**Previous Feedback:**
- V4 header had best data organization and visual presentation
- Right-aligned data components preferred

**Your Final Preference:**
- [ ] Minimal header (title + key metrics only)
- [ ] Full header with throughput graph (V4/V6 style)
- [ ] Header with live sparkline indicators
- [x] Other: I want the header from v4. The content and the alignment are spot-on.

### Q3: Activity Timeline/Swimlanes
**Previous Feedback:**
- V2 had best icon shape/style for timeline
- V3 iconography was really good

**Your Final Preference for Timeline Icons:**
- [ ] Square colored boxes with Material icons inside
- [x] Rounded rectangles with icons (V2 style)
- [ ] Small circles with abbreviated text
- [ ] No timeline section at all
- [ ] Other: _________________

---

## Section 2: Visual Design & Styling

### Q4: Event Feed Color Coding Strategy
**Previous Feedback:**
- V2 color coding was good but needed better column spacing
- V3 color coding was comprehensive and well-executed

**Your Final Preference:**
- [ ] Full row background colors (subtle) with left border accent
- [ ] Left border colors only with white text
- [ ] Icon colors only, rest monochrome
- [ ] Tool name colors + event type indicators
- [x] Other: variant 3 colors and table design. variant 5 typography styles and column spacing.

### Q5: Sidebar Visual Density
**Previous Feedback:**
- Sidebar should be compact by default
- Preset filters good for MVP, comprehensive filters for next iteration

**Your Final Preference:**
- [x] Always compact (no toggle needed)
- [ ] Toggleable compact mode
- [ ] Dense with preset filters only
- [ ] Full filters always visible
- [ ] Other: _________________

### Q6: Table Column Layout
**Previous Feedback:**
- V2 needed more space between columns
- Tables should use full width, not compact everything left

**Your Final Preference for Column Widths:**
- [ ] Fixed widths: Time(85px), Session(140px), Type(110px), Tool(90px), Details(flex)
- [ ] Responsive: Percentage-based widths
- [ ] User-adjustable column widths
- [x] Other: variant 5v2

---

## Section 3: Interactive Elements

### Q7: Filter Implementation
**Previous Feedback:**
- V3 comprehensive filters were good but visually disconnected
- Selected filters should appear near filter controls

**Your Final Preference:**
- [ ] Dropdown with checkboxes + badges next to button
- [ ] Collapsible sidebar section with multi-select
- [ ] Preset filter buttons only (MVP approach)
- [ ] Floating filter panel
- [x] Other: see my note from Q1

### Q8: Project Organization in Sidebar
**Previous Feedback:**
- Collapsible project folders are good (V1, V3)
- Projects with awaiting sessions should bubble to top

**Your Final Preference:**
- [x] Collapsible folders with session count badges
- [ ] Flat list with visual project separators
- [ ] Nested tree structure with indentation
- [ ] Other: _________________

### Q9: Timeline Interaction Model
**Previous Feedback:**
- Timeline should have clear expand/collapse toggle
- No need for zoom controls on timeline

**Your Final Preference:**
- [x] Fixed time scale with horizontal scroll
- [ ] Auto-scaling to show last X minutes
- [ ] Zoomable with controls
- [x] Collapsible only (no zoom)
- [ ] Other: _________________

---

## Section 4: Information Display

### Q10: Session Identification
**Previous Feedback:**
- Never show raw session IDs
- Project path and git branch are key identifiers

**Your Final Display Format:**
- [ ] "project-name / branch-name"
- [ ] "folder-name (branch)"
- [ ] Full path with branch as subtext
- [ ] Icon + project + branch in separate elements
- [x] Other: im thinking `folder-name / branch-name`. the logic im thinking of is a bit nuanced:
    - the project name isnt really provided. there's a world where i could work it in to the hooks framework, but that doesnt exist yet. so...
    - the project name currently is just the folder that claude code was activated in. there are cases where a user would have more than one claude session open in the same folder (e.g. if they were using one instance to execute and another instance to work on a planning doc). so in that case you'd have two of the same "project" that couldnt be differentiated by the folder name or the git branch. so then we'd pretty much have to rely on the session id, i think.
    - however, there's also the more common (i think, based on my use) case where a user has multiple instances of CC running for different worktrees/branches of the same repo. e.g. one instance in main worktree merging a PR, two instances on feature worktrees working on features. this is better for the current data model because the user can filter on folder or branch if using worktrees/branches
    - and of course those two use cases can overlap; e.g. 1 instance in main worktree working on PR, 2 instances in dev worktree documenting and planning, 1 instance in feature-a worktree, 1 instance in feature-b worktree.
    - the tl;dr is that i dont want to over-complicate this for MVP. i think i want to display the folder name as the primary title, and the branch as the subtitle. I also want to be able to filter by either of those. i also want to make sure that projects that dont have git initialized are supported too.

### Q11: Sub-agent/Task Hierarchy
**Previous Feedback:**
- Indentation important for sub-agents
- Don't gray out sub-agent text (V2 issue)

**Your Final Preference:**
- [x] Indent with same styling as parent
- [ ] Indent with subtle background shade
- [x] Tree lines connecting to parent
- [x] Separate swimlane in timeline
- [ ] Other: _________________

### Q12: Status Indicators
**Previous Feedback:**
- Awaiting input must be immediately visible
- Color dots work well (green/yellow/gray)

**Your Final Preference:**
- [ ] Colored dots only
- [ ] Dots + text labels
- [x] Background color changes
- [x] Icon changes based on status
- [ ] Other: _________________

---

## Section 5: Performance & Scaling

### Q13: Handling 30+ Sessions
**Previous Feedback:**
- Vertical scrolling needed for session list
- Dense display critical for scaling

**Your Final Preference:**
- [ ] Vertical scrolling with 22-25px rows
- [ ] Pagination with 20 visible at once
- [x] Grouping with collapsible sections
- [x] Search/filter to reduce visible set (add search to list of future features)
- [ ] Other: _________________

### Q14: Real-time Update Strategy
**Previous Feedback:**
- Live data streaming required
- Smooth transitions without jarring updates

**Your Final Preference:**
- [ ] Append new events to bottom (auto-scroll optional)
- [ ] Prepend to top with notification
- [ ] Update in-place with subtle animations
- [ ] Batch updates every X seconds
- [x] Other: for the event feed, prepend (i.e. most recent events are at the top). for the timeline, events so move from right to left across time, with most recent events on the *right*.

### Q15: Data Density Balance
**Previous Feedback:**
- 20-25px row height is optimal (I1V1 standard)
- Must show tool names and meaningful details

**Your Final Preference:**
- [ ] Maximum density: 20px rows, minimal padding
- [ ] Balanced: 24px rows, readable spacing
- [ ] Comfortable: 28px rows, more whitespace
- [ ] User-adjustable density setting
- [x] Other: depends on the component. see my other preference and my final notes.

---

## Additional Preferences

### Most Important Features (Rank 1-5)
- [1] Sessions awaiting input visibility
- [4] Timeline/swimlane visualization
- [5] Comprehensive filtering
- [2] Color coding for scannability
- [3] Project-based organization

### Definitely Exclude
- [x] Letter-based icons (R,E,W)
- [x] Emoji icons
- [x] Bar charts/graphs
- [x] Heat maps
- [x] Pattern analysis tools
- [x] Control/action buttons
- [x] Light theme option

### Final Notes
_Any specific preferences or must-haves not covered above:_

- all references are to iteration_4_v2 designs unless otherwise specified

Sidebar:
the best sidebar would be a combination of:
- variant 6: overall structure of folders + instances/subagents. content of instance/subagent components (title, branch, status dot.)
- variant 1: The fixed awaiting input section that flexes as new agents or instances enter needing input.
- variant 3: collapsible, comprehensive filters (future feature)

Header:
- variant 4 has the exact header design and functionality.

Event feed:
the best event feed combines:
- variant 3: colors and table design. 
- variant 5: typography styles and column spacing.

Timeline:
- the best timeline, based on the presented designs, would probably be variant 2. the visual style is the most mature of all the variations. HOWEVER, there is are some css issues that would need to be resolved
- Honarable mentions go to:
  - I3V6 for the subtask indentation
  - I2V3 for the interesting concept of grouping tasks in containers within the swimlane (theoretically based on the prompt and stop/subagent stop boundaries). that concept got lost in future iterations but there might be some gold there that's hard to describe with words.
  - I3V2 because the structure of the swimlanes was nice, although I didnt understand the animation of the icons. this was similar to I2V3 where the issues and how to fix them are hard to describe with words.
- Overall, I think getting this feature right overall needs to be its own epic with its own set of design iterations and refinements. It's not for MVP.

---

## Summary for Final Design

Based on your responses, the final Chronicle Dashboard should synthesize:
- The best structural elements from each variant
- Consistent visual language throughout
- Optimal information density for monitoring
- Smooth real-time performance at scale
- Clear focus on identifying sessions needing attention

This questionnaire will guide the creation of a single, definitive design that incorporates all validated patterns while avoiding known anti-patterns.