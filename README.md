# Lost City

A first-person, single-player Three.js and WebXR prototype. Explore three contiguous fictional districts on foot, take jobs, and build a neighborhood presence through deliveries and ownership. All city geometry, people, signs, and game content are original procedural or authored assets.

The 1995 setting draws on Pittsburgh's Uptown and Hill District. Low brick buildings and corner storefronts frame a distant downtown skyline. The street grid and districts are fictional, and the skyline is scenery beyond the walkable map.

The title screen uses original OpenArt key art from Seedream 5.5, creation `216oKdRSJpONcQB37RlF`. The image is served from OpenArt's CDN. If it is unavailable, the live 3D scene shows behind the title.

## Play locally

Open a terminal in the **Lost City** project folder. With Node.js installed, run:

```sh
node serve.mjs
```

Open [http://127.0.0.1:8080](http://127.0.0.1:8080) in a WebGL-capable browser. Three.js r180 is bundled, so there is no install or build step. The server binds to your machine by default. For a phone on the same Wi-Fi, set `LOST_CITY_HOST` to `0.0.0.0`, then open `http://<your-computer-LAN-IP>:8080` on the phone. On Windows PowerShell, run `$env:LOST_CITY_HOST = '0.0.0.0'` before starting the server.

| Device | Movement and looking | Actions |
| --- | --- | --- |
| Desktop | WASD or arrows. Mouse look after clicking Enter. Drag-look is available if pointer lock is unavailable. | E interacts, Shift sprints, F or Space shoves. Use the ? button to pause and review controls. |
| Mobile | Left virtual stick moves. Drag the 3D view to look. | Use interacts, Run toggles sprint, Shove repels an enemy. |
| Quest 3 | Left stick moves in the direction you face. Right stick snap-turns 30°. | Right trigger interacts, left trigger shoves, left grip sprints. |

## First playthrough

1. Enter the city and walk toward the gold marker for Mara. Interact to take **Night Shift**.
2. Follow the gold marker and minimap east to the Market pickup. Interact with the crate. The Rooks will pursue you.
3. Sprint north to Ivo and interact to deliver. You earn **$160 and 2 reputation**. A shove staggers a nearby pursuer. A second shove makes them back off. If your health runs out, you respawn, lose up to $25, and can collect the cargo again.
4. Take **On the Record** from Dani. Recover testimony from the Westline relay and get it to Mara while the Blacktops and a corrupt vice officer pursue you. Dani's work with sex workers is described in dialogue.
5. Buy **Rail House** for $120 to heal and unlock a respawn point. **Night Owl Garage** costs $230 and 2 reputation. **Blue Hour Café** costs $340 and 4 reputation. Businesses accumulate income every 45 seconds of play. Visit them to collect it. Deliveries and purchases build district influence. Reach the local target shown on the minimap to take control and boost local business income by 50%.
6. **Open Frequency** is repeatable after the story jobs. Reload from the same browser and address to resume cash, properties, health, district influence, position, and the current job. Saves are per browser and origin. If storage is unavailable, the HUD shows that saving failed.

## Garage Fight

Choose **Garage Fight** from the title or pause screen. Play as King Lo or Rivet in a best-of-three match against the other fighter. Use A/D or the arrows to move, J/K for light and heavy attacks, L to block, and I for a special. Touch controls and standard Xbox/PlayStation controller mappings are also available.

Select **Back to Lost City** to return to the city title and resume your saved progress. Garage Fight runs in a regular browser tab and has no effect on mission progress or cash. The city's separate rival encounters still use the existing Turf Wars roster.

## Test and deploy

```sh
node --test
```

The simulation tests cover a complete delivery under pursuit, shoves, defeat recovery, property gates, business income, save/restore, and collision.

For a static host, publish `index.html`, `style.css`, `main.js`, `city.js`, `sim.js`, `world.js`, `turf-wars.js`, and the entire `vendor/` and `garage/` folders. Keep the directory structure and enable HTTPS. Routes use relative paths, so deployment under a subdirectory works. There is no backend.

For a Quest 3 check, open the HTTPS deployment in Meta Quest Browser and select **Enter VR**. Confirm headset tracking, left-stick movement, right-stick turning, both triggers, the in-headset job HUD, and a save after exiting VR. Browser or device support determines whether the VR button appears. [Three.js WebXR setup](https://threejs.org/manual/#en/webxr-basics)

## Structure

- `city.js` defines districts, collision footprints, and interaction sites.
- `sim.js` owns JSON-compatible state and applies input commands through `step(state, input, dt)`. It has no browser or Three.js dependency. A multiplayer implementation could reuse the simulation on a host and broadcast snapshots. Per-player state, synchronization, and network transport are future work.
- `world.js` draws the procedural city. `main.js` handles rendering, input, HUD, WebXR, and browser persistence.
- `vendor/` bundles Three.js with its MIT license.

The prototype covers a 176 m × 176 m walkable footprint with outdoor encounters, two story jobs and one repeatable job. [Free City on SideQuest](https://sidequestvr.com/app/47650/free-city) was supplied as the reference. Its [Meta Quest listing](https://www.meta.com/en-gb/experiences/free-city/32090682337189650/) was accessible for the free-roaming city concept.
