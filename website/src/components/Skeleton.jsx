import * as styles from './Skeleton.module.scss';

function Skeleton() {
  return (
    <div className={styles.root}>
      <div className={styles.header} />
      <div className={styles.subHeader} />
      <div className={styles.content} />
      <div className={styles.content} />
      <div className={styles.content} />
      <div className={styles.content} />
      <div className={styles.content} />
      <div className={styles.codeWindow} />
      <div className={styles.content} />
      <div className={styles.content} />
    </div>
  );
}

export default Skeleton;
