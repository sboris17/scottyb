export default {
  id: "08-objects",
  title: "Objects",
  summary: "Grouping related facts about one thing, so data keeps its shape and its labels.",
  minutes: 15,
  sections: [
    {
      heading: "Labelled values",
      body: `
        <p>An array is good for "many of the same thing". An <strong>object</strong> is for
        "several facts about one thing", each with a label:</p>
        <pre class="sample"><code>const book = {
  title: "Frankenstein",
  author: "Mary Shelley",
  year: 1818,
  inPrint: true,
};</code></pre>
        <p>The labels are called <strong>keys</strong> (or properties); each has a
        <strong>value</strong>, which can be any type at all. Compare it with the array version
        — <code>["Frankenstein", "Mary Shelley", 1818, true]</code> — where you have to
        remember that position 2 means the year. The object says so.</p>
      `,
    },
    {
      heading: "Reading and writing",
      body: `
        <pre class="sample"><code>console.log(book.title);        // "Frankenstein"
console.log(book["title"]);     // same thing

book.year = 1823;               // change a value
book.pages = 280;               // add a key that did not exist
console.log(book.publisher);    // undefined — no such key</code></pre>
        <p>Dot notation is what you will write nearly always. Brackets are for when the key is
        itself in a variable:</p>
        <pre class="sample"><code>const whichKey = "author";
console.log(book[whichKey]);    // "Mary Shelley"
console.log(book.whichKey);     // undefined — looks for a key literally called "whichKey"</code></pre>
      `,
    },
    {
      heading: "Objects inside objects, objects inside arrays",
      body: `
        <p>Values can be objects or arrays, so structures nest as deeply as your data needs:</p>
        <pre class="sample"><code>const order = {
  customer: { name: "Rui", email: "rui@example.com" },
  items: [
    { name: "Mug", price: 8, quantity: 2 },
    { name: "Poster", price: 12, quantity: 1 },
  ],
};

console.log(order.customer.name);       // "Rui"
console.log(order.items[1].name);       // "Poster"
console.log(order.items.length);        // 2</code></pre>
        <p>Read those left to right: <code>order</code>, its <code>items</code>, position
        <code>1</code>, that item's <code>name</code>. An <strong>array of objects</strong> is
        the shape most real data arrives in — a list of users, rows, messages, products.</p>
      `,
    },
    {
      heading: "Walking an object's keys",
      body: `
        <pre class="sample"><code>const stock = { apples: 4, pears: 0, plums: 7 };

console.log(Object.keys(stock));     // ["apples", "pears", "plums"]
console.log(Object.values(stock));   // [4, 0, 7]

for (const fruit of Object.keys(stock)) {
  console.log(fruit + ": " + stock[fruit]);
}</code></pre>
        <p>Inside that loop <code>fruit</code> is a string holding a key name, so the value has
        to be reached with brackets — <code>stock[fruit]</code>. Writing <code>stock.fruit</code>
        looks for a key spelled "fruit" and gives <code>undefined</code>.</p>
        <p>To build up an object as you go, start empty and assign:</p>
        <pre class="sample"><code>const totals = {};
totals["apples"] = 4;
totals["apples"] = totals["apples"] + 1;   // 5</code></pre>
      `,
    },
  ],
  exercises: [
    {
      id: "objects-1",
      title: "Build and read an object",
      prompt: `
        <p>Create an object named <code>profile</code> with exactly these keys:</p>
        <ul>
          <li><code>username</code> — <code>"nadia"</code></li>
          <li><code>posts</code> — <code>42</code></li>
          <li><code>verified</code> — <code>false</code></li>
        </ul>
        <p>Then, after creating it, add one more post (so <code>posts</code> becomes 43) and
        set <code>verified</code> to <code>true</code> — by updating the object, not by
        changing the values you first typed.</p>
      `,
      starter: "const profile = {\n  \n};\n\n// Now update posts and verified.\n",
      solution: "const profile = {\n  username: \"nadia\",\n  posts: 42,\n  verified: false,\n};\n\nprofile.posts = profile.posts + 1;\nprofile.verified = true;\n",
      hints: [
        "Inside the braces, each line is key: value, separated by commas.",
        "Update a key the same way you set any variable: profile.posts = ...",
        "To add one, read the current value and store the new one: profile.posts = profile.posts + 1;",
      ],
      tests: [
        { name: "profile is an object", code: `assert.declared(() => profile, "profile"); assert.type(profile, "object");` },
        { name: 'username is "nadia"', code: `assert.equal(profile.username, "nadia");` },
        { name: "posts ended at 43", code: `assert.equal(profile.posts, 43);` },
        { name: "verified ended as true", code: `assert.equal(profile.verified, true);` },
        {
          name: "posts started at 42 and was updated",
          code: `assert.ok(/posts\\s*:\\s*42/.test(__SOURCE), "Start posts at 42 in the object, then update it afterwards.");`,
        },
      ],
    },
    {
      id: "objects-2",
      title: "Describe a person",
      prompt: `
        <p>Write <code>describe(person)</code> that takes an object with <code>name</code>,
        <code>age</code> and <code>city</code> keys and returns a sentence:</p>
        <pre class="sample"><code>describe({ name: "Rui", age: 31, city: "Porto" })
// "Rui is 31 and lives in Porto."</code></pre>
        <p>Use a template literal. Mind the full stop at the end.</p>
      `,
      starter: "function describe(person) {\n  \n}\n",
      solution: "function describe(person) {\n  return `${person.name} is ${person.age} and lives in ${person.city}.`;\n}\n",
      hints: [
        "Reach each fact with a dot: person.name, person.age, person.city.",
        "Put the whole sentence in backticks and drop each value into a ${...} slot.",
        "return `${person.name} is ${person.age} and lives in ${person.city}.`;",
      ],
      tests: [
        { name: "describe is a function", code: `assert.declared(() => describe, "describe"); assert.type(describe, "function");` },
        {
          name: "it describes Rui correctly",
          code: `assert.equal(describe({ name: "Rui", age: 31, city: "Porto" }), "Rui is 31 and lives in Porto.");`,
        },
        {
          name: "it works for a different person",
          code: `assert.equal(describe({ name: "Ines", age: 7, city: "Braga" }), "Ines is 7 and lives in Braga.");`,
        },
        {
          name: "the values are read from the object, not typed in",
          code: `assert.notOk(/Rui|Porto/.test(__SOURCE), "Read every value from the person object rather than writing the example values into the sentence.");`,
        },
      ],
    },
    {
      id: "objects-3",
      title: "Total up a shopping cart",
      prompt: `
        <p>A cart is an array of objects, each with <code>name</code>, <code>price</code> and
        <code>quantity</code>.</p>
        <p>Write two functions:</p>
        <ul>
          <li><code>cartTotal(cart)</code> — the total cost, price times quantity for every
          item, added together. An empty cart costs <code>0</code>.</li>
          <li><code>mostExpensive(cart)</code> — the <strong>name</strong> of the item with the
          highest unit price. For an empty cart return <code>null</code>.</li>
        </ul>
        <pre class="sample"><code>const cart = [
  { name: "Mug", price: 8, quantity: 2 },
  { name: "Poster", price: 12, quantity: 1 },
];
cartTotal(cart);        // 28
mostExpensive(cart);    // "Poster"</code></pre>
      `,
      starter: "function cartTotal(cart) {\n  \n}\n\nfunction mostExpensive(cart) {\n  \n}\n",
      solution: "function cartTotal(cart) {\n  let total = 0;\n  for (const item of cart) {\n    total = total + item.price * item.quantity;\n  }\n  return total;\n}\n\nfunction mostExpensive(cart) {\n  if (cart.length === 0) return null;\n\n  let best = cart[0];\n  for (const item of cart) {\n    if (item.price > best.price) {\n      best = item;\n    }\n  }\n  return best.name;\n}\n",
      hints: [
        "For the total, loop with for...of and add item.price * item.quantity each time.",
        "To find a maximum, remember the best one seen so far, starting with the first item.",
        "Keep hold of the whole item while searching, and return its .name at the very end.",
      ],
      tests: [
        { name: "cartTotal is a function", code: `assert.declared(() => cartTotal, "cartTotal"); assert.type(cartTotal, "function");` },
        {
          name: "it totals price times quantity",
          code: `assert.close(cartTotal([{ name: "Mug", price: 8, quantity: 2 }, { name: "Poster", price: 12, quantity: 1 }]), 28);`,
        },
        { name: "an empty cart totals 0", code: `assert.equal(cartTotal([]), 0);` },
        { name: "a quantity of 0 adds nothing", code: `assert.close(cartTotal([{ name: "X", price: 5, quantity: 0 }]), 0);` },
        { name: "mostExpensive is a function", code: `assert.declared(() => mostExpensive, "mostExpensive"); assert.type(mostExpensive, "function");` },
        {
          name: "it finds the priciest item",
          code: `assert.equal(mostExpensive([{ name: "Mug", price: 8, quantity: 2 }, { name: "Poster", price: 12, quantity: 1 }]), "Poster");`,
        },
        {
          name: "it compares unit price, not total spend",
          code: `assert.equal(mostExpensive([{ name: "Cheap", price: 2, quantity: 100 }, { name: "Dear", price: 50, quantity: 1 }]), "Dear");`,
        },
        { name: "an empty cart gives null", code: `assert.equal(mostExpensive([]), null);` },
        { name: "a single item is the most expensive", code: `assert.equal(mostExpensive([{ name: "Only", price: 1, quantity: 1 }]), "Only");` },
      ],
    },
  ],
};
