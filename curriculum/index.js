/**
 * The course, in order.
 *
 * Lessons are plain data so that both the browser UI and the CI verifier can read
 * them without knowing anything about each other.
 */

import hello from "./01-hello.js";
import variables from "./02-variables.js";
import strings from "./03-strings.js";
import decisions from "./04-decisions.js";
import loops from "./05-loops.js";
import functions from "./06-functions.js";
import arrays from "./07-arrays.js";
import objects from "./08-objects.js";
import debugging from "./09-debugging.js";
import capstone from "./10-capstone.js";

export const lessons = [
  hello,
  variables,
  strings,
  decisions,
  loops,
  functions,
  arrays,
  objects,
  debugging,
  capstone,
];

/** Every exercise in course order, each tagged with the lesson it belongs to. */
export const allExercises = lessons.flatMap((lesson) =>
  lesson.exercises.map((exercise) => ({
    ...exercise,
    lessonId: lesson.id,
    lessonTitle: lesson.title,
  }))
);

export function findLesson(lessonId) {
  return lessons.find((lesson) => lesson.id === lessonId) || null;
}

export const totalExercises = allExercises.length;
