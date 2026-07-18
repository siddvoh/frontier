# Running Frontier

The live site is https://siddvoh.github.io/frontier/ (GitHub Pages serving docs/ from main).

To run locally you need to have Node 20+ 

```
git clone https://github.com/siddvoh/frontier.git
cd frontier
npm install
npm test
```

The site itself is fully static so serve the docs folder with anything:

```
npx serve docs
```

Then open http://localhost:3000 

Optional scripts if you want to try:

```
npm run build   rebuilds docs/data/models.json from the files in data/
npm run fetch   pulls a fresh Epoch AI CSV snapshot
```


