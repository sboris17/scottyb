import grid from "./01-grid.js";
import functions from "./02-functions.js";
import references from "./03-references.js";
import logic from "./04-logic.js";
import criteria from "./05-criteria.js";
import lookups from "./06-lookups.js";
import text from "./07-text.js";
import dates from "./08-dates.js";
import arrays from "./09-arrays.js";
import query from "./10-query.js";

export const lessons = [grid, functions, references, logic, criteria, lookups, text, dates, arrays, query];

export const allExercises = lessons.flatMap((lesson) =>
  lesson.exercises.map((exercise) => ({ ...exercise, lessonId: lesson.id, lessonTitle: lesson.title }))
);

export function findLesson(lessonId) {
  return lessons.find((lesson) => lesson.id === lessonId) || null;
}

export const totalExercises = allExercises.length;
